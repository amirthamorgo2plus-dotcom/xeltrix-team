"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateReferrer(fd: FormData) {
  const supabase = await createClient();
  const num = (key: string) => {
    const v = fd.get(key);
    return v && String(v).trim() !== "" ? Number(v) : null;
  };
  const { error } = await supabase.from("referrers").update({
    name: (fd.get("name") as string).trim(),
    phone: (fd.get("phone") as string | null)?.trim() || null,
    email: (fd.get("email") as string | null)?.trim() || null,
    bank_details: (fd.get("bank_details") as string | null)?.trim() || null,
    default_pct: num("default_pct"),
    traded_pct: num("traded_pct"),
    manufactured_pct: num("manufactured_pct"),
    first_invoice_pct: num("first_invoice_pct"),
  }).eq("id", fd.get("id") as string);
  if (error) return { error: error.message };
  revalidatePath("/referrers");
  return { error: null };
}

export async function addCommission(fd: FormData) {
  const supabase = await createClient();
  const opportunityId = fd.get("opportunity_id") as string;
  const commissionPct = Number(fd.get("commission_pct"));
  const invoiceAmount = Number(fd.get("commission_amount")) / (commissionPct / 100);

  const { error } = await supabase.from("referrer_commissions").insert({
    team_id: fd.get("team_id") as string,
    referrer_id: fd.get("referrer_id") as string,
    lead_id: fd.get("lead_id") as string,
    opportunity_id: opportunityId,
    invoice_amount: invoiceAmount,
    invoice_category: fd.get("invoice_category") as string,
    commission_pct: commissionPct,
    commission_amount: Number(fd.get("commission_amount")),
    rate_reason: fd.get("rate_reason") as string,
    override_pct: fd.get("override_note") ? commissionPct : null,
    override_note: (fd.get("override_note") as string | null) || null,
    status: "pending",
  });

  // If first_invoice reason, mark first_invoice_used
  if (!error && fd.get("rate_reason") === "first_invoice") {
    await supabase
      .from("lead_referrers")
      .update({ first_invoice_used: true, first_invoice_id: opportunityId })
      .eq("lead_id", fd.get("lead_id") as string)
      .eq("referrer_id", fd.get("referrer_id") as string);
  }

  if (error) return { error: error.message };
  return { error: null };
}
