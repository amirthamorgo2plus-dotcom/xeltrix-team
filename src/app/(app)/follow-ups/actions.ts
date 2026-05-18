"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

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
    related_type: "lead",
    related_id: lead_id,
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

export async function reopenFollowUp(id: string) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    throw new Error("Only admin/manager can reopen.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ done_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/follow-ups");
}

export async function updateFollowUp(id: string, formData: FormData) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    throw new Error("Only admin/manager can edit follow-ups.");
  }
  const due_raw = String(formData.get("due_at") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const update: { due_at?: string; channel: string | null; notes: string | null } = {
    channel,
    notes,
  };
  if (due_raw) update.due_at = new Date(due_raw).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/follow-ups");
}

export async function deleteFollowUp(id: string) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    throw new Error("Only admin/manager can delete follow-ups.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/follow-ups");
}
