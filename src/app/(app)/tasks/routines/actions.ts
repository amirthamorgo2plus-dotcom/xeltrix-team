"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

export async function createRoutine(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) return { error: "Admins only." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const cadence = String(formData.get("cadence") ?? "");
  if (!["daily", "weekly", "monthly"].includes(cadence)) {
    return { error: "Pick a cadence." };
  }

  const assignee_mode = String(formData.get("assignee_mode") ?? "member");
  const per_person =
    assignee_mode === "everyone" && formData.get("per_person") === "on";
  const ownerRaw = String(formData.get("owner_id") ?? "").trim();
  const owner_id = ownerRaw || null;

  // A single responsible owner is required unless it's per-person for everyone.
  if (!per_person && !owner_id) {
    return { error: "Pick who is responsible (owner)." };
  }

  let weekday: number | null = null;
  let day_of_month: number | null = null;
  if (cadence === "weekly") {
    weekday = Number(formData.get("weekday"));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { error: "Pick a weekday." };
    }
  }
  if (cadence === "monthly") {
    day_of_month = Number(formData.get("day_of_month"));
    if (!Number.isInteger(day_of_month) || day_of_month < 1 || day_of_month > 31) {
      return { error: "Pick a day of the month (1–31)." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("task_routines").insert({
    team_id: m.team_id,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    cadence,
    weekday,
    day_of_month,
    assignee_mode: assignee_mode === "everyone" ? "everyone" : "member",
    owner_id: per_person ? null : owner_id,
    per_person,
    priority: String(formData.get("priority") ?? "medium"),
    active: true,
  });

  if (error) return { error: error.message };
  revalidatePath("/tasks/routines");
  revalidatePath("/tasks");
  return {};
}

export async function toggleRoutine(id: string, active: boolean) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) throw new Error("Admins only.");
  const supabase = await createClient();
  const { error } = await supabase.from("task_routines").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks/routines");
  revalidatePath("/tasks");
}

export async function deleteRoutine(id: string) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) throw new Error("Admins only.");
  const supabase = await createClient();
  // Generated task instances keep working (routine_id just goes null on delete).
  const { error } = await supabase.from("task_routines").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks/routines");
  revalidatePath("/tasks");
}
