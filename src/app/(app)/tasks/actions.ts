"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function createTask(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const owner_id = String(formData.get("owner_id") ?? "").trim() || m.id;
  const due_raw = String(formData.get("due_at") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    team_id: m.team_id,
    owner_id,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    due_at: due_raw ? new Date(due_raw).toISOString() : null,
    priority: String(formData.get("priority") ?? "medium"),
    status: "todo",
  });

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return {};
}

export async function setTaskStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
}

export async function reassignTask(id: string, owner_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ owner_id: owner_id || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
}
