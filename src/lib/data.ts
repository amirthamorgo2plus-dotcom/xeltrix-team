import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_TEAM_COOKIE = "active_team";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getMyProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, phone, timezone")
    .eq("id", user.id)
    .maybeSingle();
  return data;
});

// All active memberships for the signed-in user (one per org they belong to).
export const getMyMemberships = cache(async () => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("id, team_id, role, active, track_attendance, attendance_only, read_only")
    .eq("user_id", user.id)
    .eq("active", true);
  return data ?? [];
});

// The membership for the *current* org. Picks the org named by the
// active_team cookie if the user belongs to it, else their first org.
export const getMyMembership = cache(async () => {
  const list = await getMyMemberships();
  if (list.length === 0) return null;
  const active = (await cookies()).get(ACTIVE_TEAM_COOKIE)?.value;
  return list.find((m) => m.team_id === active) ?? list[0];
});

// True when the signed-in user is browsing as the read-only demo account.
export const isReadOnly = cache(async () => {
  const m = await getMyMembership();
  return (m as { read_only?: boolean } | null)?.read_only === true;
});

// Guard for mutating server actions. Blocks writes from the read-only demo
// account — essential for actions that use the service-role client
// (adminClient), which bypasses RLS and the database read-only triggers.
export async function assertWritable() {
  if (await isReadOnly()) {
    throw new Error("This is a read-only demo. Sign up to make changes.");
  }
}

// The user's orgs (id + name + role) for the org switcher.
export const getMyTeams = cache(async () => {
  const list = await getMyMemberships();
  if (list.length === 0) return [];
  const supabase = await createClient();
  const ids = list.map((m) => m.team_id);
  const { data: teams } = await supabase.from("teams").select("id, name").in("id", ids);
  const nameById = new Map((teams ?? []).map((t) => [t.id, t.name as string]));
  return list
    .map((m) => ({
      team_id: m.team_id as string,
      role: m.role as string,
      name: nameById.get(m.team_id) ?? "Organization",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

export const getTeamMembers = cache(async () => {
  const m = await getMyMembership();
  if (!m) return [];
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("team_members")
    .select("id, role, active, user_id, zoho_salesperson_name, zoho_advance_account_name, track_attendance, attendance_only")
    .eq("team_id", m.team_id)
    .eq("active", true)
    .order("role");

  if (!members || members.length === 0) return [];

  const userIds = members.map((mem) => mem.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }])
  );

  return members.map((mem) => ({
    ...mem,
    profiles: profileMap.get(mem.user_id) ?? null,
  }));
});

export const getTeamSettings = cache(async () => {
  const m = await getMyMembership();
  if (!m) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_settings")
    .select("config")
    .eq("team_id", m.team_id)
    .maybeSingle();
  return (data?.config ?? null) as null | {
    currency?: string;
    full_day_hours?: number;
    half_day_hours?: number;
    weekly_off?: unknown;
    target_cadence?: string;
    payment_qr_url?: string | null;
    eotm_url?: string | null;
    eotm_caption?: string | null;
    hub_links?: unknown;
  };
});

export function isAdminOrManager(role?: string | null) {
  return role === "admin" || role === "manager";
}

export function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
