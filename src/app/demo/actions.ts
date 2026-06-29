"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TEAM_COOKIE } from "@/lib/data";
import { DEMO_EMAIL, DEMO_TEAM_ID } from "@/lib/demo";

// Auto-sign-in the public read-only demo account. Triggered by the homepage
// "View Demo" button — the visitor types nothing. Signs in by password (the
// demo account is intentionally shared; the password is server-only env), points
// the active-org cookie at the demo org, and lands on the dashboard.
export async function enterDemo() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: process.env.DEMO_PASSWORD ?? "",
  });

  if (error) {
    redirect("/login?error=" + encodeURIComponent("Demo is unavailable right now."));
  }

  (await cookies()).set(ACTIVE_TEAM_COOKIE, DEMO_TEAM_ID, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  redirect("/dashboard");
}
