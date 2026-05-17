"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function createHoliday(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };

  const date = String(formData.get("date") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const working = formData.get("working_allowed") === "on";
  const tentative = formData.get("tentative") === "on";

  if (!date || !name) return { error: "Date and name are required." };

  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert({
    team_id: m.team_id,
    date,
    name,
    working_allowed: working,
    tentative,
  });

  if (error) return { error: error.message };
  revalidatePath("/holidays");
  return {};
}

export async function deleteHoliday(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/holidays");
}
