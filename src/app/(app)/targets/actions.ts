"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function setTarget(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };
  if (m.role !== "admin" && m.role !== "manager") {
    return { error: "Only admin/manager can set targets." };
  }

  const member_id = String(formData.get("member_id") ?? "");
  const monthInput = String(formData.get("month") ?? "");
  const amount = Number(formData.get("amount") ?? 0);

  if (!member_id || !monthInput) return { error: "Member and month required." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Amount must be ≥ 0." };

  const month = `${monthInput}-01`;

  const supabase = await createClient();
  const { error } = await supabase
    .from("targets")
    .upsert({ member_id, month, amount }, { onConflict: "member_id,month" });

  if (error) return { error: error.message };
  revalidatePath("/targets");
  revalidatePath("/dashboard");
  return {};
}
