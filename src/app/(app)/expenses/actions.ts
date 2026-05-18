"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";

export async function setEmployeeAdvanceMapping(
  advanceAccountName: string,
  memberId: string | null
) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    throw new Error("Only admin/manager can change mappings.");
  }

  const supabase = await createClient();

  await supabase
    .from("team_members")
    .update({ zoho_advance_account_name: null })
    .eq("team_id", m.team_id)
    .eq("zoho_advance_account_name", advanceAccountName);

  if (memberId) {
    await supabase
      .from("team_members")
      .update({ zoho_advance_account_name: advanceAccountName })
      .eq("id", memberId);
  }

  revalidatePath("/expenses");
}

export async function submitBulkExpenses(
  entries: { date: string; description: string; amount: number; category?: string | null }[]
) {
  const m = await getMyMembership();
  if (!m) throw new Error("Not in a team.");

  const clean = entries
    .filter((e) => e.date && e.description && e.amount > 0)
    .map((e) => ({
      team_id: m.team_id,
      member_id: m.id,
      date: e.date,
      description: e.description.slice(0, 200),
      amount: e.amount,
      category: e.category || null,
      status: "pending",
    }));

  if (clean.length === 0) {
    throw new Error("No valid rows to submit.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expense_submissions").insert(clean);
  if (error) throw new Error(error.message);

  revalidatePath("/expenses");
  return { inserted: clean.length };
}

export async function submitExpense(
  _prev: { error?: string } | undefined,
  formData: FormData
) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team." };

  const date = String(formData.get("date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!date) return { error: "Date is required." };
  if (!description) return { error: "Description is required." };
  if (!amount || amount <= 0) return { error: "Amount must be greater than 0." };

  const supabase = await createClient();
  const { error } = await supabase.from("expense_submissions").insert({
    team_id: m.team_id,
    member_id: m.id,
    date,
    description,
    amount,
    category,
    notes,
    status: "pending",
  });

  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return {};
}

export async function deleteSubmission(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expense_submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function verifySubmission(id: string, zohoExpenseId: string | null) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    throw new Error("Only admin/manager can verify.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_submissions")
    .update({
      status: "verified",
      zoho_expense_id: zohoExpenseId,
      verified_at: new Date().toISOString(),
      verified_by: m.id,
      reject_reason: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function rejectSubmission(id: string, reason: string) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    throw new Error("Only admin/manager can reject.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_submissions")
    .update({
      status: "rejected",
      reject_reason: reason || "No reason given",
      verified_at: new Date().toISOString(),
      verified_by: m.id,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}

export async function reopenSubmission(id: string) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) {
    throw new Error("Only admin/manager can reopen.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_submissions")
    .update({
      status: "pending",
      verified_at: null,
      verified_by: null,
      zoho_expense_id: null,
      reject_reason: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
}
