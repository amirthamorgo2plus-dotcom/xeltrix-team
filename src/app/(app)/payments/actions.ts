"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

async function requireAdmin() {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    throw new Error("Only admin/manager can access payments.");
  }
  return m;
}

export async function seedDefaults() {
  const m = await requireAdmin();
  const supabase = await createClient();
  await supabase.rpc("seed_expense_defaults", { p_team: m.team_id });
  revalidatePath("/payments");
  revalidatePath("/payments/dashboard");
}

export async function upsertItem(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "Monthly");
  const budget = Number(formData.get("budget") ?? 0) || 0;
  const due_day = Number(formData.get("due_day") ?? 1) || 1;
  const due_month_raw = String(formData.get("due_month") ?? "").trim();
  const due_month = due_month_raw ? Number(due_month_raw) : null;
  const reminder_days = Number(formData.get("reminder_days") ?? 3) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { error: "Name is required." };
  if (!category) return { error: "Category is required." };
  if (!["Monthly", "Quarterly", "Annual"].includes(frequency)) {
    return { error: "Invalid frequency." };
  }

  const payload = {
    team_id: m.team_id,
    name,
    category,
    frequency,
    budget,
    due_day,
    due_month,
    reminder_days,
    notes,
  };

  const { error } = id
    ? await supabase.from("expense_items").update(payload).eq("id", id)
    : await supabase.from("expense_items").insert(payload);

  if (error) return { error: error.message };
  revalidatePath("/payments");
  revalidatePath("/payments/dashboard");
  return {};
}

export async function deleteItem(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("expense_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/payments");
  revalidatePath("/payments/dashboard");
}

export async function markPaid(itemId: string, monthIso: string, actual: number) {
  const m = await requireAdmin();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("expense_payments").upsert(
    {
      team_id: m.team_id,
      item_id: itemId,
      month: monthIso,
      actual,
      paid_on: today,
      paid_by: m.id,
    },
    { onConflict: "item_id,month" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/payments");
  revalidatePath("/payments/dashboard");
}

export async function unmarkPaid(itemId: string, monthIso: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_payments")
    .delete()
    .eq("item_id", itemId)
    .eq("month", monthIso);
  if (error) throw new Error(error.message);
  revalidatePath("/payments");
  revalidatePath("/payments/dashboard");
}

export async function markAllPaid(monthIso: string) {
  const m = await requireAdmin();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Get all items + their current paid rows for the month
  const [{ data: items }, { data: paidRows }] = await Promise.all([
    supabase
      .from("expense_items")
      .select("id, budget")
      .eq("team_id", m.team_id)
      .eq("active", true),
    supabase
      .from("expense_payments")
      .select("item_id")
      .eq("team_id", m.team_id)
      .eq("month", monthIso),
  ]);

  const alreadyPaid = new Set((paidRows ?? []).map((p) => p.item_id));
  const toInsert = (items ?? [])
    .filter((it) => !alreadyPaid.has(it.id))
    .map((it) => ({
      team_id: m.team_id,
      item_id: it.id,
      month: monthIso,
      actual: Number(it.budget) || 0,
      paid_on: today,
      paid_by: m.id,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("expense_payments").insert(toInsert);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/payments");
  revalidatePath("/payments/dashboard");
}

export async function resetMonth(monthIso: string) {
  const m = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_payments")
    .delete()
    .eq("team_id", m.team_id)
    .eq("month", monthIso);
  if (error) throw new Error(error.message);
  revalidatePath("/payments");
  revalidatePath("/payments/dashboard");
}
