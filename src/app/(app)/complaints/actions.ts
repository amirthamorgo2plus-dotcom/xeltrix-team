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

export async function setComplaintStatus(id: string, status: string) {
  const supabase = await createClient();
  const update: { status: string; resolved_at?: string | null } = { status };
  if (status === "resolved" || status === "closed") {
    update.resolved_at = new Date().toISOString();
  } else {
    update.resolved_at = null;
  }
  const { error } = await supabase.from("complaints").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/complaints");
}
