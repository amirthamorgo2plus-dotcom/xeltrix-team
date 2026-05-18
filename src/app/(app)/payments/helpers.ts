// Pure helpers used on the payments pages.

export const CATEGORIES = [
  "Utilities & Infrastructure",
  "Statutory & Compliance",
  "People & Payroll",
  "Operations & Logistics",
  "Marketing & Sales",
  "Professional Services",
  "Digital & SaaS",
] as const;

export type ExpenseItem = {
  id: string;
  name: string;
  category: string;
  frequency: "Monthly" | "Quarterly" | "Annual";
  budget: number;
  due_day: number;
  due_month: number | null;
  reminder_days: number;
  notes: string | null;
  active: boolean;
};

export type ExpensePayment = {
  item_id: string;
  month: string; // yyyy-mm-dd (1st of month)
  actual: number;
  paid_on: string | null;
};

export function fmtMoney(n: number, currency = "INR") {
  if (n === null || n === undefined || isNaN(n)) n = 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function monthIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function shiftMonthCursor(monthCursorYm: string, delta: number): string {
  // monthCursorYm is "yyyy-mm"
  const [y, m] = monthCursorYm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function daysBetween(aIso: string, bIso: string) {
  return Math.round(
    (new Date(bIso + "T00:00:00").getTime() - new Date(aIso + "T00:00:00").getTime()) /
      86400000
  );
}

export function expectedBudgetForMonth(item: ExpenseItem, mIso: string): number {
  const month = Number(mIso.slice(5, 7));
  if (item.frequency === "Monthly") return Number(item.budget) || 0;
  if (item.frequency === "Annual") {
    return item.due_month === month ? Number(item.budget) || 0 : 0;
  }
  if (item.frequency === "Quarterly") {
    const start = item.due_month ?? 1;
    const diff = ((month - start) % 12 + 12) % 12;
    return diff % 3 === 0 ? Number(item.budget) || 0 : 0;
  }
  return 0;
}

export function annualBudgetForItem(item: ExpenseItem): number {
  const b = Number(item.budget) || 0;
  if (item.frequency === "Monthly") return b * 12;
  if (item.frequency === "Quarterly") return b * 4;
  return b;
}

export function dueDateForMonth(item: ExpenseItem, monthCursor: string): string {
  // monthCursor: "yyyy-mm-dd" (first of month)
  const [y, m] = monthCursor.slice(0, 7).split("-").map(Number);
  const dim = new Date(y, m, 0).getDate(); // last day of month m
  const day = Math.min(Math.max(item.due_day || 1, 1), dim);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
