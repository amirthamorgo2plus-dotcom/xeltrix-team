"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function setSalespersonMapping(salespersonName: string, memberId: string | null) {
  const m = await getMyMembership();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    throw new Error("Only admin/manager can change mappings.");
  }

  const supabase = await createClient();

  // 1. Clear this salesperson_name from any other team_members
  await supabase
    .from("team_members")
    .update({ zoho_salesperson_name: null })
    .eq("team_id", m.team_id)
    .eq("zoho_salesperson_name", salespersonName);

  // 2. Set the new mapping (or leave none if memberId is null)
  if (memberId) {
    await supabase
      .from("team_members")
      .update({ zoho_salesperson_name: salespersonName })
      .eq("id", memberId);

    // 3. Reassign existing opps + quotes with this salesperson to the mapped member
    await supabase
      .from("opportunities")
      .update({ owner_id: memberId })
      .eq("team_id", m.team_id)
      .eq("zoho_salesperson_name", salespersonName);

    await supabase
      .from("quotes")
      .update({ owner_id: memberId })
      .eq("team_id", m.team_id)
      .eq("zoho_salesperson_name", salespersonName);
  }

  revalidatePath("/salespersons");
  revalidatePath("/dashboard");
  revalidatePath("/targets");
}
