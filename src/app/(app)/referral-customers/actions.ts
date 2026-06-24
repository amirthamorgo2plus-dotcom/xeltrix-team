"use server";

import { createClient } from "@/lib/supabase/server";

function nullableNum(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string | null)?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function linkCustomer(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("lead_referrers").insert({
    team_id: fd.get("team_id") as string,
    lead_id: fd.get("lead_id") as string,
    referrer_id: fd.get("referrer_id") as string,
    default_commission_pct: Number(fd.get("default_commission_pct") ?? 5),
    first_commission_pct: nullableNum(fd, "first_commission_pct"),
    traded_commission_pct: nullableNum(fd, "traded_commission_pct"),
    manufactured_commission_pct: nullableNum(fd, "manufactured_commission_pct"),
    notes: (fd.get("notes") as string | null)?.trim() || null,
  });
  if (error) return { error: error.message };
  return { error: null };
}
