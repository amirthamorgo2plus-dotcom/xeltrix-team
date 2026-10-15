"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function setTarget(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };
  if (m.role !== "admin" && m.role !== "manager") {
    return { error: "Only admin/manager can set targets." };
  }

  const member_id = String(formData.get("member_id") ?? "");
  const monthInput = String(formData.get("month") ?? "");
  const amount = Number(formData.get("amount") ?? 0);

  if (!member_id || !monthInput) return { error: "Member and month required." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Amount must be ≥ 0." };

  const month = `${monthInput}-01`;

  const supabase = await createClient();
  const { error } = await supabase
    .from("targets")
    .upsert({ member_id, month, amount }, { onConflict: "member_id,month" });

  if (error) return { error: error.message };
  revalidatePath("/targets");
  revalidatePath("/dashboard");
  return {};
}

/**
 * The team's deep cleaning target for a month.
 *
 * Deliberately not a row in `targets`: that table is one amount per member,
 * and deep cleaning is one crew on one schedule, so there is nobody to hang
 * a per-person number on. This is measured against Purex cash plus Xeltrix
 * invoiced cleaning for the same month.
 */
export async function setDeepCleaningTarget(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };
  if (m.role !== "admin" && m.role !== "manager") {
    return { error: "Only admin/manager can set targets." };
  }

  const monthInput = String(formData.get("month") ?? "");
  const raw = String(formData.get("amount") ?? "").trim();
  if (!monthInput) return { error: "Month required." };

  const supabase = await createClient();
  const month = `${monthInput}-01`;

  // An empty amount clears the month rather than storing a zero target, which
  // would read as "we aimed for nothing and met it".
  if (raw === "") {
    const { error } = await supabase
      .from("deep_cleaning_targets")
      .delete()
      .eq("team_id", m.team_id)
      .eq("month", month);
    if (error) return { error: error.message };
    revalidatePath("/targets");
    revalidatePath("/dashboard");
    revalidatePath("/deep-cleaning");
    return { ok: true };
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return { error: "Amount must be ≥ 0." };

  // .select() so an RLS refusal is seen: an update blocked by policy comes
  // back as a success with no rows.
  const { data, error } = await supabase
    .from("deep_cleaning_targets")
    .upsert(
      { team_id: m.team_id, month, amount, updated_at: new Date().toISOString() },
      { onConflict: "team_id,month" }
    )
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Target was not saved — check your access." };

  revalidatePath("/targets");
  revalidatePath("/dashboard");
  revalidatePath("/deep-cleaning");
  return { ok: true };
}
