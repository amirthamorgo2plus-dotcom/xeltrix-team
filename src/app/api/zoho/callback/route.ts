import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/zoho/oauth";
import { fetchOrganizationId } from "@/lib/zoho/client";
import { getRedirectUri, isZohoRegion, DEFAULT_ZOHO_REGION } from "@/lib/zoho/config";

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

  // The org that started the connect (set in /connect). Verify the user is an
  // admin/manager of that specific org.
  const teamId = cookieStore.get("zoho_oauth_team")?.value;
  cookieStore.delete("zoho_oauth_team");
  if (!teamId) {
    return NextResponse.redirect(new URL("/integrations?error=missing_team", request.url));
  }
  const { data: m } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("team_id", teamId)
    .eq("active", true)
    .maybeSingle();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    return NextResponse.redirect(new URL("/integrations?error=forbidden", request.url));
  }

  const regionCookie = cookieStore.get("zoho_oauth_region")?.value;
  cookieStore.delete("zoho_oauth_region");
  const region = isZohoRegion(regionCookie) ? regionCookie : DEFAULT_ZOHO_REGION;

  try {
    const origin = request.nextUrl.origin;
    const tokens = await exchangeCodeForTokens(code, getRedirectUri(origin), region);

    // Use the CONNECTED account's own Zoho organization id — each org connects
    // its own Zoho. Never use a shared env org id, which would pull another
    // company's books into this org.
    const organization_id = await fetchOrganizationId(tokens.access_token, region);
    if (!organization_id) {
      return NextResponse.redirect(
        new URL(
          `/integrations?error=${encodeURIComponent(
            "Couldn't read your Zoho organization — make sure this login has Zoho Books access."
          )}`,
          request.url
        )
      );
    }
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from("integrations").upsert(
      {
        team_id: teamId,
        provider: "zoho_books",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        config: { organization_id, api_domain: tokens.api_domain, region },
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
