"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

// Annual paid-leave entitlement, one figure for the whole team. Stored in
// team_settings.config jsonb (merged, so currency/hours survive), which is why
// this needs no migration.
export async function setAnnualLeaveDays(days: number | null): Promise<{ error?: string }> {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) return { error: "Admins only" };
  if (days != null && (!Number.isFinite(days) || days < 0 || days > 365)) {
    return { error: "Enter a number of days between 0 and 365." };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("team_settings")
    .select("config")
    .eq("team_id", m.team_id)
    .maybeSingle();

  const config = {
    ...((row?.config as Record<string, unknown> | null) ?? {}),
    annual_leave_days: days,
  };

  const { error } = await supabase
    .from("team_settings")
    .upsert({ team_id: m.team_id, config }, { onConflict: "team_id" });

  if (error) return { error: error.message };
  revalidatePath("/attendance/leave");
  return {};
}
