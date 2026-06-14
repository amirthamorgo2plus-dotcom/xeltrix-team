"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { staffEmail } from "@/lib/staff";

function adminClient() {
  return createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function requireAdmin() {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) return null;
  return m;
}

function revalidateAll() {
  revalidatePath("/team");
  revalidatePath("/attendance");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

// Hide/show a member in the attendance grid (kept for sales either way).
export async function setTrackAttendance(memberId: string, value: boolean) {
  if (!(await requireAdmin())) throw new Error("Admins only.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .update({ track_attendance: value })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
  revalidateAll();
}

// Deactivate (remove from the whole app) or reactivate a member.
export async function setMemberActive(memberId: string, value: boolean) {
  if (!(await requireAdmin())) throw new Error("Admins only.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .update({ active: value })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
  revalidateAll();
}

// Toggle whether a member is restricted to the Attendance page only.
// Only plain members can be limited — never an admin/manager (who'd lock
// themselves out of management).
export async function setAttendanceOnly(memberId: string, value: boolean) {
  if (!(await requireAdmin())) throw new Error("Admins only.");
  const supabase = await createClient();
  if (value) {
    const { data: target } = await supabase
      .from("team_members")
      .select("role")
      .eq("id", memberId)
      .maybeSingle();
    if (target?.role === "admin" || target?.role === "manager") {
      throw new Error("Admins and managers can't be limited to attendance.");
    }
  }
  const { error } = await supabase
    .from("team_members")
    .update({ attendance_only: value })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
  revalidateAll();
}

// Create a no-email staff login (username + PIN), restricted to Attendance.
export async function createStaff(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const m = await requireAdmin();
  if (!m) return { error: "Admins only." };

  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");
  if (!name) return { error: "Name is required." };
  if (!/^[a-zA-Z0-9]{3,}$/.test(username))
    return { error: "Username: at least 3 letters/numbers, no spaces." };
  if (pin.length < 6) return { error: "PIN must be at least 6 characters." };

  const sb = adminClient();
  const email = staffEmail(username);

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? "Could not create the login.";
    return { error: /already/i.test(msg) ? "That username is taken." : msg };
  }

  // The on_auth_user_created trigger seeds the profile (full_name from metadata).
  const { error: memberErr } = await sb.from("team_members").insert({
    team_id: m.team_id,
    user_id: created.user.id,
    role: "member",
    active: true,
    track_attendance: true,
    attendance_only: true,
  });
  if (memberErr) {
    // Roll back the auth user so the username can be reused.
    await sb.auth.admin.deleteUser(created.user.id);
    return { error: memberErr.message };
  }

  revalidateAll();
  return { ok: true };
}
