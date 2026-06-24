"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveReferrer(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("referrers").insert({
    team_id: fd.get("team_id") as string,
    name: (fd.get("name") as string).trim(),
    phone: (fd.get("phone") as string | null)?.trim() || null,
    email: (fd.get("email") as string | null)?.trim() || null,
    bank_details: (fd.get("bank_details") as string | null)?.trim() || null,
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function markCommissionsPaid(ids: string[], paidNote: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("referrer_commissions")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_note: paidNote || null })
    .in("id", ids);
  if (error) return { error: error.message };
  return { error: null };
}

export async function overrideCommission(id: string, pct: number, note: string) {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("referrer_commissions")
    .select("invoice_amount")
    .eq("id", id)
    .single();
  const amt = Number(row?.invoice_amount ?? 0) * (pct / 100);
  const { error } = await supabase
    .from("referrer_commissions")
    .update({ override_pct: pct, override_note: note, commission_pct: pct, commission_amount: amt })
    .eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}
