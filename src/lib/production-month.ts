import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_PRODUCTION_ACCOUNTS,
  litreRate,
  parseProductionLitres,
} from "@/lib/manufacturing-cost";

/**
 * What was actually manufactured in a month, per product.
 *
 * Two sources, because production is recorded in two places and neither is
 * complete on its own:
 *
 *  - Zoho expense lines booked to a production account, where the litres are
 *    written into each line's own text ("Glass cleaner 200L"). This is the
 *    record the business already keeps, and it exists because the work has
 *    been paid for.
 *  - production_entries, for anything made but not yet paid, or made in a
 *    month whose expense has not been entered.
 *
 * Deliberately NOT derived from invoice lines. Those say what was sold, which
 * is a different question and the reason the old figure drifted from reality.
 */

export type ProductionItem = {
  product: string;
  litres: number;
  amount: number;
  /** "zoho" when read from an expense line, "log" when entered in the app. */
  source: "zoho" | "log";
};

export type MonthProduction = {
  items: ProductionItem[];
  totalLitres: number;
  totalCost: number;
  /** Most recent production date on record, across both sources and ALL time. */
  lastDate: string | null;
  lastSource: "zoho" | "log" | null;
  /** Expense lines on a production account whose text states no litres. */
  unreadLines: number;
  unreadAmount: number;
};

export async function getMonthProduction(
  supabase: SupabaseClient,
  teamId: string,
  from: string,
  to: string,
  accounts?: string[] | null
): Promise<MonthProduction> {
  const productionAccounts = accounts?.length ? accounts : DEFAULT_PRODUCTION_ACCOUNTS;

  const [{ data: monthExpenses }, { data: logRows }] = await Promise.all([
    supabase
      .from("zoho_expenses")
      .select("zoho_expense_id, date")
      .eq("team_id", teamId)
      .gte("date", from)
      .lte("date", to),
    supabase
      .from("production_entries")
      .select("date, product_name, litres, amount")
      .eq("team_id", teamId)
      .gte("date", from)
      .lte("date", to),
  ]);

  const byProduct = new Map<string, ProductionItem>();
  const add = (product: string, litres: number, amount: number, source: "zoho" | "log") => {
    // Case and spacing vary between a Zoho line and a product name, so fold
    // them together rather than showing "Glass cleaner" twice.
    const key = product.trim().toLowerCase();
    const cur = byProduct.get(key);
    if (cur) {
      cur.litres += litres;
      cur.amount += amount;
    } else {
      byProduct.set(key, { product: product.trim(), litres, amount, source });
    }
  };

  let unreadLines = 0;
  let unreadAmount = 0;
  let lastZoho: string | null = null;

  const expenseDate = new Map(
    (monthExpenses ?? []).map((e) => [e.zoho_expense_id as string, e.date as string])
  );
  const ids = [...expenseDate.keys()];
  if (ids.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data: lines } = await supabase
        .from("zoho_expense_items")
        .select("zoho_expense_id, description, amount")
        .eq("team_id", teamId)
        .in("account_name", productionAccounts)
        .in("zoho_expense_id", ids.slice(i, i + CHUNK));
      for (const l of lines ?? []) {
        const parsed = parseProductionLitres(l.description as string | null);
        const date = expenseDate.get(l.zoho_expense_id as string) ?? null;
        if (date && (!lastZoho || date > lastZoho)) lastZoho = date;
        if (parsed.length === 0) {
          // Counted but not guessed at: a bank narration states no litres.
          unreadLines++;
          unreadAmount += Number(l.amount ?? 0);
          continue;
        }
        for (const p of parsed) {
          add(p.product, p.litres, p.litres * litreRate(p.product), "zoho");
        }
      }
    }
  }

  let lastLog: string | null = null;
  for (const r of logRows ?? []) {
    const d = r.date as string;
    if (!lastLog || d > lastLog) lastLog = d;
    add(r.product_name as string, Number(r.litres ?? 0), Number(r.amount ?? 0), "log");
  }

  // The "last updated" question is about the record as a whole, not this
  // month — an empty October is exactly when you want to know it was last
  // touched in June.
  const [{ data: latestExp }, { data: latestLog }] = await Promise.all([
    supabase
      .from("zoho_expense_items")
      .select("zoho_expense_id")
      .eq("team_id", teamId)
      .in("account_name", productionAccounts)
      .limit(500),
    supabase
      .from("production_entries")
      .select("date")
      .eq("team_id", teamId)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  let latestZohoAll: string | null = null;
  const expIds = [...new Set((latestExp ?? []).map((r) => r.zoho_expense_id as string))];
  if (expIds.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < expIds.length; i += CHUNK) {
      const { data } = await supabase
        .from("zoho_expenses")
        .select("date")
        .eq("team_id", teamId)
        .in("zoho_expense_id", expIds.slice(i, i + CHUNK))
        .order("date", { ascending: false })
        .limit(1);
      const d = data?.[0]?.date as string | undefined;
      if (d && (!latestZohoAll || d > latestZohoAll)) latestZohoAll = d;
    }
  }
  const latestLogAll = (latestLog?.[0]?.date as string | undefined) ?? null;

  let lastDate: string | null = null;
  let lastSource: "zoho" | "log" | null = null;
  if (latestZohoAll && (!latestLogAll || latestZohoAll >= latestLogAll)) {
    lastDate = latestZohoAll;
    lastSource = "zoho";
  } else if (latestLogAll) {
    lastDate = latestLogAll;
    lastSource = "log";
  }

  const items = [...byProduct.values()].sort((a, b) => b.litres - a.litres);
  return {
    items,
    totalLitres: items.reduce((s, i) => s + i.litres, 0),
    totalCost: items.reduce((s, i) => s + i.amount, 0),
    lastDate,
    lastSource,
    unreadLines,
    unreadAmount,
  };
}
