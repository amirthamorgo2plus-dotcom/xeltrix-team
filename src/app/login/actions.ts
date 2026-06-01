"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const origin =
    (await headers()).get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) return { error: error.message };
  return { ok: true };
}

// Verify a 6-digit code from the email. This path does NOT use the PKCE code
// verifier cookie, so it works even when the email link opens in a different
// browser/app than where the code was requested — the common iPhone failure.
export async function verifyCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");
  if (!email) return { error: "Enter your email first." };
  if (!token) return { error: "Enter the 6-digit code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) return { error: error.message };
  // Session cookies are now set; signal the client to go to the dashboard.
  return { verified: true };
}
