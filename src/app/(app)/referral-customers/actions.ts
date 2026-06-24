"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function nullableNum(fd: FormData, key: string): number | null {
  const v = (fd.get(key) as string | null)?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function linkCustomer(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("lead_referrers").upsert({
    team_id: fd.get("team_id") as string,
    lead_id: fd.get("lead_id") as string,
    referrer_id: fd.get("referrer_id") as string,
    notes: (fd.get("notes") as string | null)?.trim() || null,
  }, { onConflict: "lead_id,referrer_id", ignoreDuplicates: true });
  if (error) return { error: error.message };
  revalidatePath("/referral-customers");
  return { error: null };
}
