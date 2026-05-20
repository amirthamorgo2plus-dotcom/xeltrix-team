"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

export async function addTaskComment(
  _prev: { error?: string } | undefined,
  formData: FormData
) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team." };

  const taskId = String(formData.get("task_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const mentionedRaw = String(formData.get("mentioned_ids") ?? "").trim();
  const mentioned_ids = mentionedRaw
    ? mentionedRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (!taskId) return { error: "Missing task id." };
  if (!body) return { error: "Comment is empty." };

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    team_id: m.team_id,
    subject_type: "task",
    subject_id: taskId,
    author_id: m.id,
    body,
    mentioned_ids,
  });

  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return {};
}

export async function deleteTaskComment(commentId: string) {
  const m = await getMyMembership();
  if (!m) throw new Error("Not in a team.");
  const supabase = await createClient();

  // RLS already restricts to author OR admin/manager, but double-check
  // here so we return a clear error if disallowed.
  const { data: existing } = await supabase
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .maybeSingle();

  if (existing && existing.author_id !== m.id && !isAdminOrManager(m.role)) {
    throw new Error("Only the author or an admin/manager can delete.");
  }

  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
}
