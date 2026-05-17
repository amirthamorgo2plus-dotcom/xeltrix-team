import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { getAllZohoIntegrations, getIntegrationForTeam } from "@/lib/zoho/client";
import { syncFromZoho } from "@/lib/zoho/sync";
import type { IntegrationRow } from "@/lib/zoho/types";

export const maxDuration = 60; // sec — sync paginates Zoho, can take a while

function isCronRequest(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

function adminClient() {
  return createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function runOne(integration: IntegrationRow) {
  try {
    const counts = await syncFromZoho(integration);
    return { team_id: integration.team_id, ok: true, ...counts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    await adminClient()
      .from("integrations")
      .update({ last_sync_error: msg })
      .eq("id", integration.id);
    return { team_id: integration.team_id, ok: false, error: msg };
  }
}

export async function GET(request: NextRequest) {
  // Path 1: Vercel cron — runs for ALL teams with a Zoho integration
  if (isCronRequest(request)) {
    const integrations = await getAllZohoIntegrations();
    const results = [];
    for (const i of integrations) results.push(await runOne(i));
    return NextResponse.json({ ok: true, results });
  }

  // Path 2: Manual user-triggered sync — only their own team
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase
    .from("team_members")
    .select("role, team_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const integration = await getIntegrationForTeam(m.team_id, /* useAdmin */ true);
  if (!integration?.refresh_token) {
    return NextResponse.json({ error: "Zoho not connected." }, { status: 400 });
  }

  const result = await runOne(integration);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return GET(request);
}
