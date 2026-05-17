import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/zoho/oauth";
import { fetchOrganizationId } from "@/lib/zoho/client";
import { getRedirectUri } from "@/lib/zoho/config";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  if (errParam) {
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(errParam)}`, request.url)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/integrations?error=missing_params", request.url));
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get("zoho_oauth_state")?.value;
  cookieStore.delete("zoho_oauth_state");
  if (!expected || expected !== state) {
    return NextResponse.redirect(new URL("/integrations?error=bad_state", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: m } = await supabase
    .from("team_members")
    .select("role, team_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    return NextResponse.redirect(new URL("/integrations?error=forbidden", request.url));
  }

  try {
    const origin = request.nextUrl.origin;
    const tokens = await exchangeCodeForTokens(code, getRedirectUri(origin));

    // Prefer an explicit ZOHO_ORG_ID from env (avoids the /organizations endpoint
    // which requires elevated permissions some Zoho Books plans don't grant).
    // Fall back to auto-detection.
    const envOrgId = process.env.ZOHO_ORG_ID?.trim();
    const organization_id = envOrgId || (await fetchOrganizationId(tokens.access_token));
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from("integrations").upsert(
      {
        team_id: m.team_id,
        provider: "zoho_books",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        config: { organization_id, api_domain: tokens.api_domain },
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        last_sync_error: null,
      },
      { onConflict: "team_id,provider" }
    );

    return NextResponse.redirect(new URL("/integrations?connected=1", request.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
