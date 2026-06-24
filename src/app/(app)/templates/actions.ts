"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveCostPrice(id: string, cost: number | null) {
  const supabase = await createClient();
  await supabase.from("opportunity_templates").update({ cost_price: cost }).eq("id", id);
}
