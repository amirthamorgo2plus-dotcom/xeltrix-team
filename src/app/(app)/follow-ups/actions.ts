"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function createFollowUp(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };

  const lead_id = String(formData.get("lead_id") ?? "");
  const due_raw = String(formData.get("due_at") ?? "");

  if (!lead_id) return { error: "Pick a lead." };
  if (!due_raw) return { error: "Pick a due date." };

  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").insert({
    team_id: m.team_id,
    owner_id: m.id,
    lead_id,
    due_at: new Date(due_raw).toISOString(),
    channel: String(formData.get("channel") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/follow-ups");
  return {};
}

export async function markDone(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ done_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/follow-ups");
}
