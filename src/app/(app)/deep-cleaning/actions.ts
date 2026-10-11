"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// An UPDATE or DELETE blocked by RLS is not an error in PostgREST — it simply
// matches zero rows and reports success. Selecting the affected rows back lets
// us tell "blocked" apart from "done", so the UI can say so instead of
// silently refreshing with the old value still in place.
const NO_PERMISSION =
  "You don't have permission to change this. Ask an admin or manager.";

function num(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string | null)?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const STATUSES = ["enquiry", "confirmed", "done", "cancelled"] as const;
type JobStatus = (typeof STATUSES)[number];

function str(fd: FormData, key: string): string | null {
  return (fd.get(key) as string | null)?.trim() || null;
}

export async function saveJob(fd: FormData) {
  const supabase = await createClient();
  const id = (fd.get("id") as string | null) || null;

  const status = (str(fd, "status") ?? "enquiry") as JobStatus;
  if (!STATUSES.includes(status)) return { error: "Unknown status." };

  // An enquiry has no agreed day yet; a booking is the day itself, so it
  // cannot be saved without one or it would never reach the calendar.
  const serviceDate = str(fd, "service_date");
  if ((status === "confirmed" || status === "done") && !serviceDate) {
    return { error: "A confirmed or completed job needs a service date." };
  }

  const amount = num(fd, "amount") ?? 0;
  const referralPct = num(fd, "referral_pct");
  const referrerId = (fd.get("referrer_id") as string | null)?.trim() || null;
  const referralAmount = referrerId && referralPct != null ? (amount * referralPct) / 100 : null;

  const row = {
    team_id: fd.get("team_id") as string,
    customer_name: (fd.get("customer_name") as string).trim(),
    phone: (fd.get("phone") as string | null)?.trim() || null,
    address: (fd.get("address") as string | null)?.trim() || null,
    status,
    service_date: serviceDate,
    enquiry_date: str(fd, "enquiry_date") ?? new Date().toISOString().slice(0, 10),
    source: str(fd, "source"),
    property_type: str(fd, "property_type"),
    crew_size: num(fd, "crew_size"),
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

  const { data, error } = id
    ? await supabase.from("deep_cleaning_jobs").update(row).eq("id", id).select("id")
    : await supabase.from("deep_cleaning_jobs").insert(row).select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  revalidatePath("/deep-cleaning");
  revalidatePath("/deep-cleaning/calendar");
  revalidatePath("/calendar");
  return { error: null };
}

/** Move a job along the pipeline from the list, without opening the form. */
export async function setJobStatus(id: string, status: string) {
  if (!STATUSES.includes(status as JobStatus)) return { error: "Unknown status." };
  const supabase = await createClient();

  // Checked BEFORE the write. Confirming a job with no agreed day would set
  // the status and then leave it off the calendar entirely — the one place
  // anyone would look for it.
  if (status === "confirmed" || status === "done") {
    const { data: existing } = await supabase
      .from("deep_cleaning_jobs")
      .select("service_date")
      .eq("id", id)
      .maybeSingle();
    if (existing && !existing.service_date) {
      return { error: "Set a service date first — open the job and pick a day." };
    }
  }

  const { data, error } = await supabase
    .from("deep_cleaning_jobs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  revalidatePath("/deep-cleaning");
  revalidatePath("/deep-cleaning/calendar");
  revalidatePath("/calendar");
  return { error: null };
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deep_cleaning_jobs")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  revalidatePath("/deep-cleaning");
  revalidatePath("/deep-cleaning/calendar");
  revalidatePath("/calendar");
  return { error: null };
}

export async function setPaymentStatus(id: string, status: "pending" | "paid") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deep_cleaning_jobs")
    .update({ payment_status: status })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  revalidatePath("/deep-cleaning");
  revalidatePath("/deep-cleaning/calendar");
  revalidatePath("/calendar");
  return { error: null };
}

export async function setReferralStatus(id: string, status: "pending" | "paid") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deep_cleaning_jobs")
    .update({ referral_status: status, referral_paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  revalidatePath("/deep-cleaning");
  revalidatePath("/referrers");
  return { error: null };
}
