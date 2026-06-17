"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { type SupabaseClient } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/super-admin";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function findUserByEmail(sb: SupabaseClient, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === target);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
  return null;
}

// Provision a new organization with its first admin (by email). Creates the
// admin login if they haven't signed up yet (they sign in via magic link).
export async function createOrg(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  if (!(await isSuperAdmin())) return { error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("admin_email") ?? "").trim().toLowerCase();
  if (!name) return { error: "Organization name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid admin email." };

  const sb = adminClient();
  let userId: string;
  const existing = await findUserByEmail(sb, email);
  if (existing) {
    userId = existing.id;
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data?.user) {
      return { error: error?.message ?? "Could not create the admin user." };
    }
    userId = data.user.id;
  }

  const { error } = await sb.rpc("create_team", { p_name: name, p_admin: userId });
  if (error) return { error: error.message };

  revalidatePath("/admin/orgs");
  return { ok: true };
}

// Re-send the magic-link sign-in email to an org's admin (e.g. they never
// logged in). Sends to every admin/manager of the org.
export async function resendInvite(teamId: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: "Not authorized." };
  const sb = adminClient();

  const { data: admins } = await sb
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("active", true)
    .in("role", ["admin", "manager"]);
  if (!admins || admins.length === 0) return { error: "No admin on this org." };

  const emails: string[] = [];
  for (const a of admins) {
    const { data } = await sb.auth.admin.getUserById(a.user_id as string);
    if (data?.user?.email) emails.push(data.user.email);
  }
  if (emails.length === 0) return { error: "No admin email found." };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  for (const email of emails) {
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
  }
  return {};
}

export async function renameOrg(teamId: string, name: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: "Not authorized." };
  const clean = name.trim();
  if (!clean) return { error: "Name required." };
  const sb = adminClient();
  const { error } = await sb.from("teams").update({ name: clean }).eq("id", teamId);
  if (error) return { error: error.message };
  revalidatePath("/admin/orgs");
  return {};
}

// Delete an org and ALL its data (cascades via team_id FKs). Irreversible.
export async function deleteOrg(teamId: string): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: "Not authorized." };
  const sb = adminClient();
  const { error } = await sb.from("teams").delete().eq("id", teamId);
  if (error) return { error: error.message };
  revalidatePath("/admin/orgs");
  return {};
}
