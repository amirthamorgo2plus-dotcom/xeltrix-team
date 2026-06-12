import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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

export const getMyMembership = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("id, team_id, role, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  return data;
});

export const getTeamMembers = cache(async () => {
  const m = await getMyMembership();
  if (!m) return [];
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("team_members")
    .select("id, role, active, user_id, zoho_salesperson_name, zoho_advance_account_name")
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
