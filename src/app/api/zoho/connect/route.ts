import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { buildAuthUrl } from "@/lib/zoho/oauth";
import { getRedirectUri, isZohoRegion, DEFAULT_ZOHO_REGION } from "@/lib/zoho/config";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Admin/manager of the CURRENT org (respects the active-org switch).
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    return NextResponse.redirect(new URL("/integrations?error=forbidden", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("zoho_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });
  // Remember which org started the connect, so the callback attaches the
  // integration to the right org even if anything shifts mid-flow.
  cookieStore.set("zoho_oauth_team", m.team_id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // Data center to connect in (defaults to India).
  const regionParam = request.nextUrl.searchParams.get("region");
  const region = isZohoRegion(regionParam) ? regionParam : DEFAULT_ZOHO_REGION;
  cookieStore.set("zoho_oauth_region", region, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const origin = request.nextUrl.origin;
  const url = buildAuthUrl(getRedirectUri(origin), state, region);
  return NextResponse.redirect(url);
}
