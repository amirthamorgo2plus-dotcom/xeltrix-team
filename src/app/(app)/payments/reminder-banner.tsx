import { Bell, AlertTriangle } from "lucide-react";
import {
  daysBetween,
  dueDateForMonth,
  expectedBudgetForMonth,
  fmtMoney,
  type ExpenseItem,
  type ExpensePayment,
} from "./helpers";

export function ReminderBanner({
  items,
  paidMap,
  monthCursor,
  today,
}: {
  items: ExpenseItem[];
  paidMap: Map<string, ExpensePayment>;
  monthCursor: string;
  today: string;
}) {
  type Row = { id: string; name: string; due: string; amount: number; days: number };
  const rows: Row[] = [];

  items.forEach((it) => {
    if (paidMap.has(it.id)) return;
    const expected = expectedBudgetForMonth(it, monthCursor);
    if (expected <= 0 && it.frequency !== "Monthly") return; // Only flag items relevant to this period
    const due = dueDateForMonth(it, monthCursor);
    const days = daysBetween(today, due);
    const remind = it.reminder_days ?? 3;
    if (days > remind) return;
    rows.push({ id: it.id, name: it.name, due, amount: expected, days });
  });

  if (rows.length === 0) return null;

  rows.sort((a, b) => a.days - b.days);
  const overdue = rows.filter((r) => r.days < 0).length;
  const dueToday = rows.filter((r) => r.days === 0).length;
  const upcoming = rows.length - overdue - dueToday;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const Icon = overdue > 0 ? AlertTriangle : Bell;

  const tone =
    overdue > 0
      ? "border-red-500/40 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent"
      : dueToday > 0
        ? "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent"
        : "border-sky-500/40 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent";

  return (
    <div className={`flex flex-col gap-3 rounded-lg border ${tone} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <Icon
          className={`h-5 w-5 shrink-0 ${
            overdue > 0
              ? "text-red-500"
              : dueToday > 0
                ? "text-amber-500"
                : "text-sky-500"
          }`}
        />
        <div className="flex-1">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {rows.length} payment{rows.length === 1 ? "" : "s"} need attention
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {[
              overdue > 0 ? `${overdue} overdue` : null,
              dueToday > 0 ? `${dueToday} due today` : null,
              upcoming > 0 ? `${upcoming} upcoming` : null,
              total > 0 ? `total ${fmtMoney(total)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-xs">
        {rows.slice(0, 6).map((r) => {
          let label: string;
          let cls: string;
          if (r.days < 0) {
            label = `Overdue ${Math.abs(r.days)}d`;
            cls = "text-red-600 dark:text-red-400";
          } else if (r.days === 0) {
            label = "Due today";
            cls = "text-amber-600 dark:text-amber-400";
          } else {
            label = `Due in ${r.days}d`;
            cls = "text-sky-600 dark:text-sky-400";
          }
          return (
            <li
              key={r.id}
              className="flex items-center gap-3 border-t border-dashed border-zinc-200 pt-1 dark:border-zinc-800"
            >
              <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                {r.name}
              </span>
              <span className={`font-medium ${cls}`}>{label}</span>
              <span className="tabular-nums text-zinc-500">
                {r.amount > 0 ? fmtMoney(r.amount) : ""}
              </span>
            </li>
          );
        })}
        {rows.length > 6 && (
          <li className="text-zinc-500">…and {rows.length - 6} more</li>
        )}
      </ul>
    </div>
  );
}
