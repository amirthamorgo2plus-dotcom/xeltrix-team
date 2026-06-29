"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager, isReadOnly, assertWritable } from "@/lib/data";
import { getIntegrationForTeam, zohoFetch } from "@/lib/zoho/client";
import { syncFromZoho } from "@/lib/zoho/sync";

// List the Zoho organizations this connection's login can access, so the admin
// can pick the right one (a single Zoho login may have several orgs).
export async function listZohoOrgs(): Promise<{
  ok: boolean;
  orgs?: { id: string; name: string }[];
  error?: string;
}> {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) return { ok: false, error: "Admins only." };
  const integration = await getIntegrationForTeam(m.team_id, true);
  if (!integration?.refresh_token) return { ok: false, error: "Zoho not connected." };
  try {
    const json = await zohoFetch<{
      organizations?: { organization_id: string; name: string }[];
    }>(integration, "/organizations");
    return {
      ok: true,
      orgs: (json.organizations ?? []).map((o) => ({ id: o.organization_id, name: o.name })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to list organizations." };
  }
}

// Point this org's Zoho connection at a specific organization id.
export async function setZohoOrg(orgId: string): Promise<{ error?: string }> {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) return { error: "Admins only." };
  if (await isReadOnly()) return { error: "This is a read-only demo. Sign up to make changes." };
  const sb = adminClient();
  const { data: row } = await sb
    .from("integrations")
    .select("config")
    .eq("team_id", m.team_id)
    .eq("provider", "zoho_books")
    .maybeSingle();
  const config = {
    ...((row?.config as Record<string, unknown> | null) ?? {}),
    organization_id: orgId,
  };
  const { error } = await sb
    .from("integrations")
    .update({ config, last_sync_error: null })
    .eq("team_id", m.team_id)
    .eq("provider", "zoho_books");
  if (error) return { error: error.message };
  revalidatePath("/integrations");
  return {};
}

// Delete THIS org's Zoho-sourced records (use if the wrong Zoho org was synced).
export async function clearSyncedData(): Promise<{ ok?: boolean; error?: string }> {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) return { error: "Admins only." };
  if (await isReadOnly()) return { error: "This is a read-only demo. Sign up to make changes." };
  const sb = adminClient();
  for (const t of ["opportunities", "quotes", "leads", "zoho_expenses", "opportunity_templates"]) {
    const { error } = await sb.from(t).delete().eq("team_id", m.team_id);
    if (error) return { error: `${t}: ${error.message}` };
  }
  for (const p of [
    "/integrations",
    "/dashboard",
    "/leads",
    "/opportunities",
    "/quotes",
    "/expenses",
    "/templates",
    "/salespersons",
  ])
    revalidatePath(p);
  return { ok: true };
}

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
  await assertWritable();
  const supabase = await createClient();
  await supabase
    .from("integrations")
    .delete()
    .eq("team_id", m.team_id)
    .eq("provider", "zoho_books");
  revalidatePath("/integrations");
}

export async function triggerSync(since?: string) {
  try {
    const m = await getMyMembership();
    if (!m || (m.role !== "admin" && m.role !== "manager")) {
      return { ok: false as const, error: "Only admin/manager can sync." };
    }
    if (await isReadOnly()) {
      return { ok: false as const, error: "This is a read-only demo. Sign up to make changes." };
    }

    const integration = await getIntegrationForTeam(m.team_id, /* useAdmin */ true);
    if (!integration?.refresh_token) {
      return { ok: false as const, error: "Zoho not connected." };
    }

    try {
      const counts = await syncFromZoho(integration, { since });
      // best-effort: clear any prior error
      try {
        await adminClient()
          .from("integrations")
          .update({ last_sync_error: null })
          .eq("id", integration.id);
      } catch { /* ignore */ }
      revalidatePath("/integrations");
      revalidatePath("/dashboard");
      revalidatePath("/leads");
      revalidatePath("/opportunities");
      revalidatePath("/quotes");
      revalidatePath("/salespersons");
      revalidatePath("/expenses");
      revalidatePath("/templates");
      revalidatePath("/follow-ups");
      return { ok: true as const, ...counts };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown_error";
      try {
        await adminClient()
          .from("integrations")
          .update({ last_sync_error: msg })
          .eq("id", integration.id);
      } catch { /* ignore so we still return msg */ }
      revalidatePath("/integrations");
      return { ok: false as const, error: msg };
    }
  } catch (outer) {
    // Anything before/around the inner block (env vars, admin client init, etc.)
    return {
      ok: false as const,
      error: outer instanceof Error ? outer.message : "unknown_outer_error",
    };
  }
}
