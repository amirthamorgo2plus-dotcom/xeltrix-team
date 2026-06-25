"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function num(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string | null)?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function saveJob(fd: FormData) {
  const supabase = await createClient();
  const id = (fd.get("id") as string | null) || null;

  const amount = num(fd, "amount") ?? 0;
  const referralPct = num(fd, "referral_pct");
  const referrerId = (fd.get("referrer_id") as string | null)?.trim() || null;
  const referralAmount = referrerId && referralPct != null ? (amount * referralPct) / 100 : null;

  const row = {
    team_id: fd.get("team_id") as string,
    customer_name: (fd.get("customer_name") as string).trim(),
    phone: (fd.get("phone") as string | null)?.trim() || null,
    address: (fd.get("address") as string | null)?.trim() || null,
    service_date: (fd.get("service_date") as string) || new Date().toISOString().slice(0, 10),
    description: (fd.get("description") as string | null)?.trim() || null,
    amount,
    cost: num(fd, "cost"),
    payment_status: (fd.get("payment_status") as string) || "pending",
    payment_mode: (fd.get("payment_mode") as string | null)?.trim() || null,
    referrer_id: referrerId,
    referral_pct: referrerId ? referralPct : null,
    referral_amount: referralAmount,
    assigned_to: (fd.get("assigned_to") as string | null)?.trim() || null,
    notes: (fd.get("notes") as string | null)?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("deep_cleaning_jobs").update(row).eq("id", id)
    : await supabase.from("deep_cleaning_jobs").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/deep-cleaning");
  return { error: null };
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deep_cleaning_jobs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/deep-cleaning");
  return { error: null };
}

export async function setPaymentStatus(id: string, status: "pending" | "paid") {
  const supabase = await createClient();
  const { error } = await supabase.from("deep_cleaning_jobs").update({ payment_status: status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/deep-cleaning");
  return { error: null };
}

export async function setReferralStatus(id: string, status: "pending" | "paid") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("deep_cleaning_jobs")
    .update({ referral_status: status, referral_paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/deep-cleaning");
  revalidatePath("/referrers");
  return { error: null };
}
