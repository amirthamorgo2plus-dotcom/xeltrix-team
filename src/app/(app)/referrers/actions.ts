"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveReferrer(fd: FormData) {
  const supabase = await createClient();
  const num = (key: string) => {
    const v = fd.get(key);
    return v && String(v).trim() !== "" ? Number(v) : null;
  };
  const { error } = await supabase.from("referrers").insert({
    team_id: fd.get("team_id") as string,
    name: (fd.get("name") as string).trim(),
    phone: (fd.get("phone") as string | null)?.trim() || null,
    email: (fd.get("email") as string | null)?.trim() || null,
    bank_details: (fd.get("bank_details") as string | null)?.trim() || null,
    default_pct: num("default_pct"),
    traded_pct: num("traded_pct"),
    manufactured_pct: num("manufactured_pct"),
    first_invoice_pct: num("first_invoice_pct"),
  });
  if (error) return { error: error.message };
  return { error: null };
}

// Set the status of whichever commissions were ticked. Marking back to pending
// clears the payment stamp, so a mistake can be undone rather than lived with.
export async function setCommissionStatus(
  ids: string[],
  status: "paid" | "pending",
  paidNote?: string
) {
  if (ids.length === 0) return { error: "Nothing selected." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referrer_commissions")
    .update(
      status === "paid"
        ? { status, paid_at: new Date().toISOString(), paid_note: paidNote?.trim() || null }
        : { status, paid_at: null, paid_note: null }
    )
    .in("id", ids)
    .select("id");
  if (error) return { error: error.message };
  // An RLS-blocked update reports success with zero rows, so check.
  if (!data?.length) return { error: "You don't have permission to change these." };
  revalidatePath("/referrers");
  return { error: null, updated: data.length };
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
