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

  // Clear this account name from any other team_members in the same team
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
