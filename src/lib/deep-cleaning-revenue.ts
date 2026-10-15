import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * All deep cleaning revenue, from both companies.
 *
 * The work is one crew on one schedule, but it is billed two ways and so it
 * lands in two places:
 *
 *   Purex   — non-GST cash. Only ever recorded as a job, so the job holds
 *             the money.
 *   Xeltrix — a GST invoice, which reaches the app as an S- line on a Zoho
 *             invoice. The invoice holds the money; the job is the
 *             operational record of the same work.
 *
 * Adding the two is only safe because a job carries its billing entity, so
 * a Xeltrix job's amount is never counted here as well as on its invoice.
 */

/** Zoho item names that mean "we cleaned something", not "we sold a cleaner". */
export const DEFAULT_DEEP_CLEANING_ITEMS = [
  "S-DEEP CLEANING",
  "S-FACILITY DEEP CLEANING SERVICES",
];

export type DeepCleaningRevenue = {
  purex: number;
  purexJobs: number;
  xeltrix: number;
  xeltrixLines: number;
  total: number;
  /** Jobs marked as billed by Xeltrix, for reconciling against the invoices. */
  xeltrixJobs: number;
};

export async function getDeepCleaningRevenue(
  supabase: SupabaseClient,
  teamId: string,
  from: string,
  to: string,
  itemNames?: string[] | null
): Promise<DeepCleaningRevenue> {
  const names = itemNames?.length ? itemNames : DEFAULT_DEEP_CLEANING_ITEMS;

  const [{ data: jobs }, { data: invoices }] = await Promise.all([
    supabase
      .from("deep_cleaning_jobs")
      .select("amount, status, billing_entity, service_date")
      .eq("team_id", teamId)
      .in("status", ["done", "confirmed"])
      .gte("service_date", from)
      .lte("service_date", to),
    supabase
      .from("zoho_invoices")
      .select("zoho_invoice_id")
      .eq("team_id", teamId)
      .gte("date", from)
      .lte("date", to),
  ]);

  let purex = 0;
  let purexJobs = 0;
  let xeltrixJobs = 0;
  for (const j of jobs ?? []) {
    if (j.billing_entity === "xeltrix") {
      // Counted from its invoice below, never from here.
      xeltrixJobs++;
      continue;
    }
    purex += Number(j.amount ?? 0);
    purexJobs++;
  }

  let xeltrix = 0;
  let xeltrixLines = 0;
  const ids = (invoices ?? []).map((i) => i.zoho_invoice_id as string);
  if (ids.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data: lines } = await supabase
        .from("zoho_invoice_items")
        .select("name, amount")
        .eq("team_id", teamId)
        .in("zoho_invoice_id", ids.slice(i, i + CHUNK));
      for (const l of lines ?? []) {
        // Matched on the item name, case-insensitively: "S-DEEP CLEANING" is
        // the service, "X-FLOOR CLEANER" is a product that happens to
        // contain the word.
        const name = String(l.name ?? "").trim().toUpperCase();
        if (!names.some((n) => n.trim().toUpperCase() === name)) continue;
        xeltrix += Number(l.amount ?? 0);
        xeltrixLines++;
      }
    }
  }

  return { purex, purexJobs, xeltrix, xeltrixLines, xeltrixJobs, total: purex + xeltrix };
}
