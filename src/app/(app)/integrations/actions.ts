"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function disconnectZoho() {
  const m = await getMyMembership();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    throw new Error("Only admin/manager can disconnect.");
  }
  const supabase = await createClient();
  await supabase
    .from("integrations")
    .delete()
    .eq("team_id", m.team_id)
    .eq("provider", "zoho_books");
  revalidatePath("/integrations");
}

export async function triggerSync() {
  const m = await getMyMembership();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    throw new Error("Only admin/manager can sync.");
  }
  // We just call our own /api/zoho/sync via a relative fetch.
  // In server actions we don't have a request origin, so use the env-configured site URL.
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${process.env.VERCEL_URL ?? "xeltrix-team.vercel.app"}`;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${base}/api/zoho/sync`, {
    method: "POST",
    headers: session?.access_token
      ? { Cookie: `sb-access-token=${session.access_token}` }
      : {},
  });
  const json = await res.json().catch(() => ({}));
  revalidatePath("/integrations");
  revalidatePath("/dashboard");
  return json;
}
