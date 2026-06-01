"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

// Save / clear the Employee of the Month image (+ optional caption/name).
// Admin/manager only. Stored in team_settings.config, merged so other settings
// are preserved.
export async function setEotm(
  imageUrl: string | null,
  caption: string | null
): Promise<{ error?: string }> {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) return { error: "Admins only" };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("team_settings")
    .select("config")
    .eq("team_id", m.team_id)
    .maybeSingle();

  const config = {
    ...((row?.config as Record<string, unknown> | null) ?? {}),
    eotm_url: imageUrl,
    eotm_caption: imageUrl ? (caption?.trim() || null) : null,
  };

  const { error } = await supabase
    .from("team_settings")
    .upsert({ team_id: m.team_id, config }, { onConflict: "team_id" });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}
