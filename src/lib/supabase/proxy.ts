import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname === "/";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Attendance-only staff (no email, PIN login) can only use /attendance.
  // One lightweight lookup; their home is /attendance everywhere.
  let attendanceOnly = false;
  if (user) {
    const { data: m } = await supabase
      .from("team_members")
      .select("attendance_only")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    attendanceOnly = m?.attendance_only === true;
  }

  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = attendanceOnly ? "/attendance" : "/dashboard";
    return NextResponse.redirect(url);
  }

  if (
    attendanceOnly &&
    !pathname.startsWith("/attendance") &&
    !pathname.startsWith("/auth") &&
    !isPublic
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/attendance";
    return NextResponse.redirect(url);
  }

  return response;
}
