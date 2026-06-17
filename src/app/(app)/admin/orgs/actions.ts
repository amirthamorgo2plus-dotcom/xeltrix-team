"use server";

import { revalidatePath } from "next/cache";
import { type SupabaseClient } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/super-admin";
import { adminClient } from "@/lib/supabase/admin";

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
