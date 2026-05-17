"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { pushWonOpportunityToZoho } from "@/lib/zoho/sync";

export async function createOpportunity(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const valueRaw = String(formData.get("value") ?? "0");
  const value = Number(valueRaw) || 0;

  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").insert({
    team_id: m.team_id,
    owner_id: m.id,
    lead_id: (String(formData.get("lead_id") ?? "") || null) as string | null,
    title,
    value,
    stage: String(formData.get("stage") ?? "prospecting"),
    close_date: (String(formData.get("close_date") ?? "") || null) as string | null,
  });

  if (error) return { error: error.message };
  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
  return {};
}

export async function setOpportunityStage(id: string, stage: string) {
  const supabase = await createClient();
  const update: { stage: string; close_date?: string } = { stage };
  if (stage === "won") update.close_date = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("opportunities").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  if (stage === "won") {
    // Fire and forget push to Zoho — don't block the UI on it
    pushWonOpportunityToZoho(id).catch((e) =>
      console.error("Zoho push failed:", e instanceof Error ? e.message : e)
    );
  }

  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
}
