import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function memberNameLookup() {
  const supabase = await createClient();
  const [{ data: members }, { data: profiles }] = await Promise.all([
    supabase.from("team_members").select("id, user_id"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? null])
  );

  return new Map(
    (members ?? []).map((m) => [m.id, profileMap.get(m.user_id) ?? null])
  );
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
