"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

/**
 * Store the labour and travel rates the team actually uses, so the calculator
 * does not open on a number from the code every time. Lives in the existing
 * team_settings.config jsonb — no migration, and an admin can change it
 * without one either.
 */
export async function saveQuoteDefaults(labourPerPersonDay: number, travelFlat: number) {
  const me = await getMyMembership();
  if (!me) return { error: "Not in a team" };
  if (!isAdminOrManager(me.role)) return { error: "Only an admin or manager can set the defaults." };

  const labour = Number(labourPerPersonDay);
  const travel = Number(travelFlat);
  if (!Number.isFinite(labour) || labour < 0) return { error: "Labour rate must be a positive number." };
  if (!Number.isFinite(travel) || travel < 0) return { error: "Travel must be a positive number." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("team_settings")
    .select("config")
    .eq("team_id", me.team_id)
    .maybeSingle();

  // Merge rather than replace: config holds the leave allowance, the currency
  // and the hub links too.
  const config = {
    ...((current?.config as Record<string, unknown>) ?? {}),
    deep_cleaning_rates: { labour_per_person_day: labour, travel_flat: travel },
  };

  const { data, error } = await supabase
    .from("team_settings")
    .upsert({ team_id: me.team_id, config }, { onConflict: "team_id" })
    .select("team_id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "You don't have permission to change the defaults." };
  revalidatePath("/deep-cleaning/quote");
  return { error: null };
}
