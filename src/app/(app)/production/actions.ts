"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { litreRate } from "@/lib/manufacturing-cost";

// An UPDATE or DELETE blocked by RLS matches zero rows and reports success,
// so the affected rows are selected back to tell "blocked" from "done".
const NO_PERMISSION = "You don't have permission to change this entry.";

function refresh() {
  revalidatePath("/production");
  revalidatePath("/dashboard");
}

export async function saveProduction(
  _prev: { error?: string; saved?: boolean; savedAt?: number } | undefined,
  fd: FormData
) {
  const me = await getMyMembership();
  if (!me) return { error: "Not in a team" };

  const id = (fd.get("id") as string | null)?.trim() || null;
  const date = String(fd.get("date") ?? "").trim();
  if (!date) return { error: "Pick a date." };

  const templateId = (fd.get("template_id") as string | null)?.trim() || null;
  const productName = String(fd.get("product_name") ?? "").trim();
  if (!productName) return { error: "Pick a product." };

  const litres = Number(fd.get("litres"));
  if (!Number.isFinite(litres) || litres <= 0) return { error: "Litres must be more than zero." };

  // The rate comes from the product, not the form: it is a rule
  // (soap oil & phenyl ₹5, everything else ₹10), not a per-entry decision.
  // Stored alongside the amount so a future rate change cannot rewrite it.
  const rate = litreRate(productName);
  const amount = Math.round(litres * rate * 100) / 100;

  const row = {
    team_id: me.team_id,
    date,
    template_id: templateId,
    product_name: productName,
    litres,
    rate,
    amount,
    notes: (fd.get("notes") as string | null)?.trim() || null,
    recorded_by: me.id,
  };

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("production_entries").update(row).eq("id", id).select("id")
    : await supabase.from("production_entries").insert(row).select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  refresh();
  // savedAt changes on every success, which the form uses to remount its
  // fields — clearing them without a setState-inside-effect.
  return { saved: true, savedAt: Date.now() };
}

export async function deleteProduction(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("production_entries")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  refresh();
  return { error: null };
}
