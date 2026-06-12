"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { normalizeHubLinks, type HubLink } from "./links";

// Save the Command Center links. Admin/manager only. Stored in
// team_settings.config jsonb under `hub_links`, merging so other settings
// (currency, payment_qr_url, eotm_*, etc.) are preserved.
export async function setHubLinks(links: HubLink[]): Promise<{ error?: string }> {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) return { error: "Admins only" };

  // Re-normalize server-side so a malformed client payload can't poison /hub.
  const clean = normalizeHubLinks(links) ?? [];

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("team_settings")
    .select("config")
    .eq("team_id", m.team_id)
    .maybeSingle();

  const config = {
    ...((row?.config as Record<string, unknown> | null) ?? {}),
    hub_links: clean,
  };

  const { error } = await supabase
    .from("team_settings")
    .upsert({ team_id: m.team_id, config }, { onConflict: "team_id" });
  if (error) return { error: error.message };

  revalidatePath("/hub");
  revalidatePath("/profile");
  return {};
}
