"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

// Save (or clear) the company payment-QR image URL. Admin/manager only.
// Stored inside team_settings.config jsonb under `payment_qr_url`, merging so
// other settings (currency, hours, etc.) are preserved.
export async function setPaymentQr(
  imageUrl: string | null
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
    payment_qr_url: imageUrl,
  };

  const { error } = await supabase
    .from("team_settings")
    .upsert(
      { team_id: m.team_id, config },
      { onConflict: "team_id" }
    );
  if (error) return { error: error.message };

  revalidatePath("/payment-qr");
  return {};
}
