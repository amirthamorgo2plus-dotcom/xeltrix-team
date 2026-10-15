"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

export type FeedbackState = { error?: string; ok?: boolean } | undefined;

export async function createFeedback(_prev: FeedbackState, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };
  if ((m as { attendance_only?: boolean }).attendance_only) {
    return { error: "Not allowed." };
  }

  const customer_name = String(formData.get("customer_name") ?? "").trim();
  const rating = Number(formData.get("rating") ?? 0);
  if (!customer_name) return { error: "Customer name is required." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Pick a rating from 1 to 5." };
  }

  const supabase = await createClient();

  // Match an existing customer so feedback lands on the same record as their
  // orders and complaints. Unlike createComplaint this does NOT create a lead
  // for an unknown name: someone saying thank you is not a sales lead, and
  // inventing one would quietly pollute the pipeline.
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("team_id", m.team_id)
    .ilike("name", customer_name)
    .limit(1)
    .maybeSingle();

  const jobId = String(formData.get("deep_cleaning_job_id") ?? "").trim();
  const channel = String(formData.get("channel") ?? "phone");
  const receivedOn = String(formData.get("received_on") ?? "").trim();

  const { data, error } = await supabase
    .from("customer_feedback")
    .insert({
      team_id: m.team_id,
      customer_name,
      lead_id: lead?.id ?? null,
      deep_cleaning_job_id: jobId || null,
      rating,
      comment: String(formData.get("comment") ?? "").trim() || null,
      channel,
      received_on: receivedOn || undefined,
      recorded_by: m.id,
    })
    .select("id");

  if (error) return { error: error.message };
  // An insert blocked by RLS comes back as a success with no rows.
  if (!data || data.length === 0) return { error: "Not saved — check your access." };

  revalidatePath("/feedback");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteFeedback(id: string) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };
  if (!isAdminOrManager(m.role)) return { error: "Only admin/manager can delete feedback." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_feedback")
    .delete()
    .eq("id", id)
    .eq("team_id", m.team_id)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Not deleted — check your access." };

  revalidatePath("/feedback");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Turn a bad piece of feedback into a complaint.
 *
 * The two tables stay separate -- feedback is not a case -- but an unhappy
 * customer usually needs one, and retyping what they said is how it ends up
 * never being raised at all.
 */
export async function raiseComplaintFromFeedback(id: string) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };

  const supabase = await createClient();
  const { data: fb, error: readErr } = await supabase
    .from("customer_feedback")
    .select("id, customer_name, comment, rating, complaint_id")
    .eq("id", id)
    .eq("team_id", m.team_id)
    .maybeSingle();

  if (readErr) return { error: readErr.message };
  if (!fb) return { error: "Feedback not found." };
  if (fb.complaint_id) return { error: "A complaint was already raised for this." };

  const { data: complaint, error } = await supabase
    .from("complaints")
    .insert({
      team_id: m.team_id,
      owner_id: m.id,
      customer_name: fb.customer_name,
      subject: `Feedback: ${fb.rating}/5 from ${fb.customer_name}`,
      description: fb.comment,
      // 1 out of 5 is someone who will not come back; 2 is someone who might.
      severity: fb.rating <= 1 ? "high" : "medium",
      status: "open",
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!complaint) return { error: "Complaint was not created — check your access." };

  const { error: linkErr } = await supabase
    .from("customer_feedback")
    .update({ complaint_id: complaint.id })
    .eq("id", id)
    .eq("team_id", m.team_id);
  if (linkErr) return { error: linkErr.message };

  revalidatePath("/feedback");
  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true };
}
