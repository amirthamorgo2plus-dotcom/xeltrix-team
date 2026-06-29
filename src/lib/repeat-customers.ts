// Repeat Customer Tracker — pure aggregation over won opportunities (= synced
// Zoho invoices). Groups a team's orders by customer, derives each customer's
// typical reorder interval from their own history, and flags who is due/overdue
// for a reorder. No DB writes — used by the page and the dashboard card alike.
import { differenceInDays, parseISO, addDays, format } from "date-fns";

// A won-opportunity row as queried from Supabase (lead joined for name/phone).
export type Lead = { id: string; name: string | null; company_name?: string | null; phone: string | null };
export type WonOppRow = {
  id: string;
  title: string | null;
  value: number | null;
  value_excl_tax?: number | null;
  close_date: string | null; // yyyy-mm-dd (order/invoice date)
  lead_id: string | null;
  zoho_customer_id: string | null;
  owner_id: string | null;
  zoho_salesperson_name: string | null;
  lead?: Lead | Lead[] | null;
};

export type ReorderStatus = "overdue" | "due_soon" | "on_track";

export type CustomerStat = {
  key: string;
  name: string;
  phone: string | null;
  ownerId: string | null;
  salesperson: string | null;
  orderCount: number;
  firstOrder: string; // yyyy-mm-dd
  lastOrder: string; // yyyy-mm-dd
  totalValue: number;
  avgOrderValue: number;
  typicalIntervalDays: number; // median gap between consecutive orders
  daysSinceLast: number;
  expectedNextDate: string; // yyyy-mm-dd
  overdueRatio: number; // daysSinceLast / typicalInterval
  status: ReorderStatus;
};

// Tunable thresholds (ratio of days-since-last-order to the customer's typical interval).
export const OVERDUE_RATIO = 1.25; // 25% past their normal cycle → overdue
export const DUE_SOON_RATIO = 0.9; // within 10% of the cycle → nudge now

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function leadOf(r: WonOppRow): Lead | null {
  return Array.isArray(r.lead) ? (r.lead[0] ?? null) : (r.lead ?? null);
}

// Customer display name: prefer the linked lead, else parse "INV# · NAME" title.
function nameOf(r: WonOppRow): string {
  const lead = leadOf(r);
  if (lead?.company_name) return lead.company_name;
  if (lead?.name) return lead.name;
  const parts = (r.title ?? "").split("·");
  return parts.length > 1 ? parts.slice(1).join("·").trim() : (r.title ?? "Unknown");
}

function statusFor(ratio: number): ReorderStatus {
  if (ratio > OVERDUE_RATIO) return "overdue";
  if (ratio >= DUE_SOON_RATIO) return "due_soon";
  return "on_track";
}

type Group = {
  key: string;
  name: string;
  phone: string | null;
  ownerId: string | null;
  salesperson: string | null;
  dates: string[];
  values: number[];
};

// Build per-customer reorder stats. Only customers with >= 2 orders qualify
// (need at least one interval to estimate a cadence).
export function computeRepeatCustomers(
  rows: WonOppRow[],
  opts?: { today?: Date }
): CustomerStat[] {
  const today = opts?.today ?? new Date();
  const groups = new Map<string, Group>();

  for (const r of rows) {
    if (!r.close_date) continue;
    const lead = leadOf(r);
    const name = nameOf(r);
    const key = r.zoho_customer_id || r.lead_id || name.trim().toLowerCase();
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { key, name, phone: lead?.phone ?? null, ownerId: r.owner_id ?? null, salesperson: r.zoho_salesperson_name ?? null, dates: [], values: [] };
      groups.set(key, g);
    }
    g.dates.push(r.close_date);
    g.values.push(Number(r.value ?? 0));
    // keep the most recent order's owner/phone/name as the canonical display
    if (!g.phone && lead?.phone) g.phone = lead.phone;
    if (!g.salesperson && r.zoho_salesperson_name) g.salesperson = r.zoho_salesperson_name;
  }

  const stats: CustomerStat[] = [];
  for (const g of groups.values()) {
    if (g.dates.length < 2) continue;
    const sorted = [...g.dates].sort(); // ISO yyyy-mm-dd sorts lexicographically
    const firstOrder = sorted[0];
    const lastOrder = sorted[sorted.length - 1];

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(differenceInDays(parseISO(sorted[i]), parseISO(sorted[i - 1])));
    }
    const typicalIntervalDays = Math.max(1, Math.round(median(gaps)));
    const daysSinceLast = Math.max(0, differenceInDays(today, parseISO(lastOrder)));
    const overdueRatio = daysSinceLast / typicalIntervalDays;
    const totalValue = g.values.reduce((a, b) => a + b, 0);

    stats.push({
      key: g.key,
      name: g.name,
      phone: g.phone,
      ownerId: g.ownerId,
      salesperson: g.salesperson,
      orderCount: g.dates.length,
      firstOrder,
      lastOrder,
      totalValue,
      avgOrderValue: totalValue / g.values.length,
      typicalIntervalDays,
      daysSinceLast,
      expectedNextDate: format(addDays(parseISO(lastOrder), typicalIntervalDays), "yyyy-MM-dd"),
      overdueRatio,
      status: statusFor(overdueRatio),
    });
  }

  // Most-overdue first.
  stats.sort((a, b) => b.overdueRatio - a.overdueRatio);
  return stats;
}

export type RepeatSummary = {
  repeatCount: number;
  overdueCount: number;
  dueSoonCount: number;
  dueCount: number; // overdue + due_soon
  valueAtRisk: number; // Σ avgOrderValue of overdue customers
};

export function summarize(stats: CustomerStat[]): RepeatSummary {
  let overdueCount = 0;
  let dueSoonCount = 0;
  let valueAtRisk = 0;
  for (const s of stats) {
    if (s.status === "overdue") {
      overdueCount++;
      valueAtRisk += s.avgOrderValue;
    } else if (s.status === "due_soon") {
      dueSoonCount++;
    }
  }
  return {
    repeatCount: stats.length,
    overdueCount,
    dueSoonCount,
    dueCount: overdueCount + dueSoonCount,
    valueAtRisk,
  };
}
