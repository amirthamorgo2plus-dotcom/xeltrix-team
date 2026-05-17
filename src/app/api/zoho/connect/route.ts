import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/zoho/oauth";
import { getRedirectUri } from "@/lib/zoho/config";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Verify caller is an admin/manager of their team
  const { data: m } = await supabase
    .from("team_members")
    .select("role, team_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!m || (m.role !== "admin" && m.role !== "manager")) {
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

  const origin = request.nextUrl.origin;
  const url = buildAuthUrl(getRedirectUri(origin), state);
  return NextResponse.redirect(url);
}
