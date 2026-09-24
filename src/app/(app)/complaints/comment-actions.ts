"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

// Case history for a complaint. Uses the shared polymorphic `comments` table
// from 00017, whose check constraint already allows subject_type='complaint' —
// no new table needed. @-mentions fire the same notification trigger as tasks.
export async function addComplaintComment(
  _prev: { error?: string } | undefined,
  formData: FormData
) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team." };

  const complaintId = String(formData.get("complaint_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!complaintId) return { error: "Missing complaint id." };
  if (!body) return { error: "Write something first." };

  const mentionedRaw = String(formData.get("mentioned_ids") ?? "").trim();
  const mentioned_ids = mentionedRaw
    ? mentionedRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    team_id: m.team_id,
    subject_type: "complaint",
    subject_id: complaintId,
    author_id: m.id,
    body,
    mentioned_ids,
  });

  if (error) return { error: error.message };
  revalidatePath("/complaints");
  return {};
}

export async function deleteComplaintComment(commentId: string) {
  const m = await getMyMembership();
  if (!m) throw new Error("Not in a team.");
  const supabase = await createClient();

  // RLS already restricts this to the author or an admin/manager; checking
  // here too just yields a clearer message than a silent no-op.
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
  revalidatePath("/complaints");
}
