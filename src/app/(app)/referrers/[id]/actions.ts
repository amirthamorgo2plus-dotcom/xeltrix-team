"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMyMembership } from "@/lib/data";
import {
  calcCommission,
  groupItemsByInvoice,
  isCategoryRated,
} from "@/lib/referrer-commission";

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

// One-step bulk logging. The detail table already computes what each eligible
// invoice is worth, but committing it meant one pass through the Add
// Commission form per invoice — which is why referrer_commissions sat empty.
// This recomputes the same figures SERVER-side (never trusting numbers posted
// from the browser) and writes them in one go, optionally marking them paid in
// the same action.
export type BulkCommissionResult =
  | { error: string }
  | { logged: number; total: number; paid: boolean };

export async function logAllCommissions(
  referrerId: string,
  opts: { markPaid: boolean; note: string }
): Promise<BulkCommissionResult> {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team." };
  const teamId = m.team_id;

  const supabase = await createClient();

  const { data: ref } = await supabase
    .from("referrers")
    .select("id, default_pct, first_invoice_pct, traded_pct, manufactured_pct")
    .eq("id", referrerId)
    .eq("team_id", teamId)
    .single();
  if (!ref) return { error: "Referrer not found." };

  const [{ data: links }, { data: existing }] = await Promise.all([
    supabase
      .from("lead_referrers")
      .select("lead_id")
      .eq("referrer_id", referrerId)
      .eq("team_id", teamId),
    supabase
      .from("referrer_commissions")
      .select("opportunity_id")
      .eq("referrer_id", referrerId)
      .eq("team_id", teamId),
  ]);

  const leadIds = [...new Set((links ?? []).map((l) => l.lead_id as string))];
  if (leadIds.length === 0) return { error: "No customers linked to this referrer." };

  const { data: invoices } = await supabase
    .from("opportunities")
    .select("id, value, value_excl_tax, close_date, lead_id, zoho_invoice_id")
    .eq("team_id", teamId)
    .not("zoho_invoice_id", "is", null)
    .in("lead_id", leadIds);

  // Line items only matter when the referrer is paid per item category.
  const categoryRated = isCategoryRated(ref);
  const zohoInvoiceIds = [
    ...new Set((invoices ?? []).map((i) => i.zoho_invoice_id as string).filter(Boolean)),
  ];
  const { data: lineItems } = categoryRated && zohoInvoiceIds.length > 0
    ? await supabase
        .from("zoho_invoice_items")
        .select("zoho_invoice_id, name, amount")
        .eq("team_id", teamId)
        .in("zoho_invoice_id", zohoInvoiceIds)
    : { data: [] };
  const itemsByInvoice = groupItemsByInvoice(
    lineItems as Array<{ zoho_invoice_id: string; name: string | null; amount: number | null }> | null
  );

  const alreadyLogged = new Set((existing ?? []).map((c) => c.opportunity_id as string));
  const available = (invoices ?? []).filter((inv) => !alreadyLogged.has(inv.id as string));
  if (available.length === 0) return { error: "Every eligible invoice is already logged." };

  // Earliest invoice per customer gets the 1st-invoice rate — same rule the
  // detail table displays.
  const earliest = new Map<string, { id: string; date: string }>();
  for (const inv of invoices ?? []) {
    const lead = inv.lead_id as string | null;
    if (!lead) continue;
    const date = (inv.close_date as string) ?? "9999-12-31";
    const prev = earliest.get(lead);
    if (!prev || date < prev.date) earliest.set(lead, { id: inv.id as string, date });
  }

  const firstInvoiceOppIds: Array<{ leadId: string; oppId: string }> = [];
  const rows = available.flatMap((inv) => {
    const base = Number(inv.value_excl_tax ?? inv.value ?? 0);
    const leadId = inv.lead_id as string;
    const zid = inv.zoho_invoice_id as string | null;
    const isFirst = earliest.get(leadId)?.id === inv.id;

    const calc = calcCommission({
      rates: ref,
      base,
      isFirstInvoice: isFirst,
      items: zid ? itemsByInvoice.get(zid) : null,
    });

    // A zero-rate invoice would only create a junk ₹0 record.
    if (!(calc.amount > 0)) return [];
    if (calc.reason === "first_invoice") firstInvoiceOppIds.push({ leadId, oppId: inv.id as string });

    return [{
      team_id: teamId,
      referrer_id: referrerId,
      lead_id: leadId,
      opportunity_id: inv.id as string,
      invoice_amount: base,
      // Record which rate actually applied, so the history is auditable.
      invoice_category: calc.reason === "category_split" ? "mixed" : "default",
      commission_pct: Math.round(calc.pct * 100) / 100,
      commission_amount: calc.amount,
      rate_reason: calc.reason,
      override_note:
        calc.reason === "category_split" && calc.breakdown
          ? calc.breakdown
              .map((b) => `${b.category} ₹${Math.round(b.base)} @ ${b.pct}%`)
              .join(", ")
          : null,
      status: "pending",
    }];
  });

  if (rows.length === 0) {
    return {
      error: categoryRated
        ? "Nothing to log — none of these invoices carry items at a rate this referrer earns on."
        : "Nothing to log — the referrer's commission rate is 0%.",
    };
  }

  const { data: inserted, error } = await supabase
    .from("referrer_commissions")
    .insert(rows)
    .select("id, commission_amount");

  if (error) return { error: error.message };
  // An RLS-blocked insert on this manually-created table would come back empty.
  if (!inserted?.length) {
    return { error: "You don't have permission to log commissions here." };
  }

  // Mirror addCommission: a consumed 1st-invoice rate is recorded on the link.
  for (const f of firstInvoiceOppIds) {
    await supabase
      .from("lead_referrers")
      .update({ first_invoice_used: true, first_invoice_id: f.oppId })
      .eq("lead_id", f.leadId)
      .eq("referrer_id", referrerId);
  }

  const total = inserted.reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);

  if (opts.markPaid) {
    const { error: payErr } = await supabase
      .from("referrer_commissions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_note: opts.note?.trim() || null,
      })
      .in("id", inserted.map((r) => r.id as string));
    if (payErr) {
      // The records exist; only the payment stamp failed. Say so precisely
      // rather than implying nothing happened.
      return {
        error: `Logged ${inserted.length} commissions, but marking them paid failed: ${payErr.message}`,
      };
    }
  }

  revalidatePath(`/referrers/${referrerId}`);
  revalidatePath("/referrers");
  return { logged: inserted.length, total, paid: opts.markPaid };
}
