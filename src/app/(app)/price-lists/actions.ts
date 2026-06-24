"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function upsertPriceList(
  teamId: string,
  leadId: string,
  rows: Array<{ item_id: string; custom_rate: number; note?: string }>
) {
  const supabase = await createClient();
  const records = rows.map((r) => ({
    team_id: teamId,
    lead_id: leadId,
    item_id: r.item_id,
    custom_rate: r.custom_rate,
    note: r.note ?? null,
  }));
  const { error } = await supabase
    .from("customer_price_lists")
    .upsert(records, { onConflict: "team_id,lead_id,item_id" });
  if (error) return { error: error.message };
  revalidatePath("/price-lists");
  return { error: null };
}

export async function deletePriceListRow(id: string) {
  const supabase = await createClient();
  await supabase.from("customer_price_lists").delete().eq("id", id);
  revalidatePath("/price-lists");
}
