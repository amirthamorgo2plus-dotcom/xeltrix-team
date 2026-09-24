"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function createComplaint(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };

  const customer_name = String(formData.get("customer_name") ?? "").trim();
  const customer_email = String(formData.get("customer_email") ?? "").trim() || null;
  const subject = String(formData.get("subject") ?? "").trim();
  if (!customer_name || !subject) return { error: "Customer and subject are required." };

  const supabase = await createClient();

  // If this customer name doesn't match an existing lead, create one
  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("team_id", m.team_id)
    .ilike("name", customer_name)
    .limit(1)
    .maybeSingle();

  if (!existingLead) {
    await supabase.from("leads").insert({
      team_id: m.team_id,
      owner_id: m.id,
      name: customer_name,
      email: customer_email,
      source: "complaint",
      status: "new",
    });
  }

  const { error } = await supabase.from("complaints").insert({
    team_id: m.team_id,
    owner_id: m.id,
    customer_name,
    customer_email,
    subject,
    description: String(formData.get("description") ?? "").trim() || null,
    severity: String(formData.get("severity") ?? "medium"),
    status: "open",
  });

  if (error) return { error: error.message };
  revalidatePath("/complaints");
  revalidatePath("/leads");
  return {};
}


// Edit a logged complaint. Until now nothing but `status` could be changed, so
// a typo in the subject or a mis-set severity was permanent.
export async function updateComplaint(fd: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team." };

  const id = String(fd.get("id") ?? "").trim();
  if (!id) return { error: "Missing complaint id." };

  const customer_name = String(fd.get("customer_name") ?? "").trim();
  const subject = String(fd.get("subject") ?? "").trim();
  if (!customer_name || !subject) return { error: "Customer and subject are required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("complaints")
    .update({
      customer_name,
      customer_email: String(fd.get("customer_email") ?? "").trim() || null,
      subject,
      description: String(fd.get("description") ?? "").trim() || null,
      severity: String(fd.get("severity") ?? "medium"),
    })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Couldn't update — it may have been deleted." };
  revalidatePath("/complaints");
  return {};
}

// Status change carrying the resolution note, so closing a complaint records
// what was actually done rather than just that it ended.
export async function resolveComplaint(fd: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team." };

  const id = String(fd.get("id") ?? "").trim();
  const status = String(fd.get("status") ?? "").trim();
  if (!id || !status) return { error: "Missing complaint id or status." };

  const note = String(fd.get("resolution_note") ?? "").trim();
  const closing = status === "resolved" || status === "closed";
  if (closing && !note) return { error: "Say what was done before resolving." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("complaints")
    .update({
      status,
      resolution_note: note || null,
      resolved_at: closing ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Couldn't update — it may have been deleted." };
  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return {};
}
