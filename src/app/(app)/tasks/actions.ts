"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { istInputToIso } from "@/lib/ist";

const NO_PERMISSION = "You don't have permission to change this task.";

// A task's own page is a separate cache entry from the list, so both have to
// be invalidated or an edit appears to do nothing on whichever page you are
// not looking at.
function revalidateTask(id?: string) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/report");
  if (id) revalidatePath(`/tasks/${id}`);
}

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
    due_at: istInputToIso(due_raw),
    priority: String(formData.get("priority") ?? "medium"),
    status: "todo",
  });

  if (error) return { error: error.message };
  revalidateTask();
  return {};
}

/** Edit the fields that are not already covered by the inline controls. */
export async function updateTask(
  _prev: { error?: string; saved?: boolean } | undefined,
  formData: FormData
) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing task." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const due_raw = String(formData.get("due_at") ?? "");

  const supabase = await createClient();
  // RLS refuses by matching no rows rather than erroring, so a blocked update
  // comes back successful and empty. Ask for the id to tell them apart.
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      due_at: istInputToIso(due_raw),
      priority: String(formData.get("priority") ?? "medium"),
    })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  revalidateTask(id);
  return { saved: true };
}

export async function setTaskStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(NO_PERMISSION);
  revalidateTask(id);
}

export async function reassignTask(id: string, owner_id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ owner_id: owner_id || null })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(NO_PERMISSION);
  revalidateTask(id);
}
