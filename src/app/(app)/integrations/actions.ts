"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { getIntegrationForTeam } from "@/lib/zoho/client";
import { syncFromZoho } from "@/lib/zoho/sync";

function adminClient() {
  return createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function disconnectZoho() {
  const m = await getMyMembership();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    throw new Error("Only admin/manager can disconnect.");
  }
  const supabase = await createClient();
  await supabase
    .from("integrations")
    .delete()
    .eq("team_id", m.team_id)
    .eq("provider", "zoho_books");
  revalidatePath("/integrations");
}

export async function triggerSync() {
  const m = await getMyMembership();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    return { ok: false, error: "Only admin/manager can sync." };
  }

  const integration = await getIntegrationForTeam(m.team_id, /* useAdmin */ true);
  if (!integration?.refresh_token) {
    return { ok: false, error: "Zoho not connected." };
  }

  try {
    const counts = await syncFromZoho(integration);
    revalidatePath("/integrations");
    revalidatePath("/dashboard");
    return { ok: true, ...counts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    await adminClient()
      .from("integrations")
      .update({ last_sync_error: msg })
      .eq("id", integration.id);
    revalidatePath("/integrations");
    return { ok: false, error: msg };
  }
}
