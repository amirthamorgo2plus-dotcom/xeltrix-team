import "server-only";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { refreshAccessToken } from "./oauth";
import { ZOHO_API } from "./config";
import type { IntegrationRow } from "./types";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createSbAdmin(url, srk, { auth: { persistSession: false } });
}

export async function getIntegrationForTeam(teamId: string, useAdmin = false): Promise<IntegrationRow | null> {
  const supabase = useAdmin ? adminClient() : await createSupabaseServer();
  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("team_id", teamId)
    .eq("provider", "zoho_books")
    .maybeSingle();
  return (data as IntegrationRow | null) ?? null;
}

export async function getAllZohoIntegrations(): Promise<IntegrationRow[]> {
  const supabase = adminClient();
  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("provider", "zoho_books")
    .not("refresh_token", "is", null);
  return (data as IntegrationRow[] | null) ?? [];
}

async function ensureFreshAccessToken(integration: IntegrationRow): Promise<string> {
  const expiresAt = integration.expires_at ? new Date(integration.expires_at).getTime() : 0;
  const margin = 60_000; // refresh 1 min early
  if (integration.access_token && expiresAt - margin > Date.now()) {
    return integration.access_token;
  }
  if (!integration.refresh_token) throw new Error("No refresh token; reconnect Zoho.");

  const tokens = await refreshAccessToken(integration.refresh_token);
  const newExpires = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const sb = adminClient();
  await sb
    .from("integrations")
    .update({
      access_token: tokens.access_token,
      expires_at: newExpires,
    })
    .eq("id", integration.id);

  return tokens.access_token;
}

type FetchOpts = {
  method?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export async function zohoFetch<T = unknown>(
  integration: IntegrationRow,
  path: string,
  opts: FetchOpts = {}
): Promise<T> {
  const token = await ensureFreshAccessToken(integration);
  const orgId = integration.config?.organization_id;
  if (!orgId) throw new Error("organization_id missing in integration config");

  const url = new URL(`${ZOHO_API}${path}`);
  url.searchParams.set("organization_id", orgId);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho ${opts.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export async function fetchOrganizationId(accessToken: string): Promise<string> {
  const res = await fetch(`${ZOHO_API}/organizations`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch organizations: ${await res.text()}`);
  }
  const json = (await res.json()) as { organizations?: { organization_id: string }[] };
  const first = json.organizations?.[0];
  if (!first) throw new Error("No Zoho Books organization found for this account.");
  return first.organization_id;
}
