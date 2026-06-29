"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient as createSbAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager, isReadOnly, assertWritable } from "@/lib/data";
import { staffEmail } from "@/lib/staff";

function adminClient() {
  return createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function findUserByEmail(sb: SupabaseClient, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === target);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
  return null;
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

// Invite a teammate by email into the CURRENT org with a role, and send them a
// magic-link sign-in email. Creates their login if they're new.
export async function inviteMember(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const m = await requireAdmin();
  if (!m) return { error: "Admins only." };
  if (await isReadOnly()) return { error: "This is a read-only demo. Sign up to make changes." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(formData.get("role") ?? "member");
  const role = ["admin", "manager", "member"].includes(roleRaw) ? roleRaw : "member";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };

  const sb = adminClient();
  let userId: string;
  const existing = await findUserByEmail(sb, email);
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data?.user) return { error: error?.message ?? "Could not create the user." };
    userId = data.user.id;
  }

  const { error: upErr } = await sb.from("team_members").upsert(
    {
      team_id: m.team_id,
      user_id: userId,
      role,
      active: true,
      track_attendance: true,
      attendance_only: false,
    },
    { onConflict: "team_id,user_id" }
  );
  if (upErr) return { error: upErr.message };

  // Email them a sign-in link/code so they can get in.
  try {
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    const supabase = await createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
  } catch {
    /* membership added even if the email send hiccups */
  }

  revalidateAll();
  return { ok: true };
}

// Re-send a sign-in link to an existing member (email logins only; PIN staff
// don't use email).
export async function resendMemberInvite(memberId: string): Promise<{ error?: string; ok?: boolean }> {
  const m = await requireAdmin();
  if (!m) return { error: "Admins only." };
  if (await isReadOnly()) return { error: "This is a read-only demo. Sign up to make changes." };
  const sb = adminClient();
  const { data: member } = await sb
    .from("team_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("team_id", m.team_id)
    .maybeSingle();
  if (!member?.user_id) return { error: "Member not found." };

  const { data } = await sb.auth.admin.getUserById(member.user_id as string);
  const email = data?.user?.email;
  if (!email) return { error: "No email on file." };
  if (email.endsWith("@staff.local")) return { error: "Staff sign in with their PIN, not email." };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// Hide/show a member in the attendance grid (kept for sales either way).
export async function setTrackAttendance(memberId: string, value: boolean) {
  if (!(await requireAdmin())) throw new Error("Admins only.");
  await assertWritable();
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
  await assertWritable();
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
  await assertWritable();
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
  if (await isReadOnly()) return { error: "This is a read-only demo. Sign up to make changes." };

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
