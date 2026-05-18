import { redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import {
  fmtMoney,
  expectedBudgetForMonth,
  annualBudgetForItem,
  type ExpenseItem,
} from "../helpers";
import { Tabs } from "../tabs";
import { YearNav } from "../month-nav";
import { ExpensesCharts } from "./charts";

export default async function PaymentsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) redirect("/dashboard");

  const sp = await searchParams;
  const year = sp.year ? Number(sp.year) : new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const supabase = await createClient();
  const [{ data: itemsRaw }, { data: payments }] = await Promise.all([
    supabase
      .from("expense_items")
      .select(
        "id, name, category, frequency, budget, due_day, due_month, reminder_days, notes, active"
      )
      .eq("active", true),
    supabase
      .from("expense_payments")
      .select("item_id, month, actual")
      .gte("month", yearStart)
      .lte("month", yearEnd),
  ]);

  const items: ExpenseItem[] = (itemsRaw ?? []) as ExpenseItem[];

  const monthIsos: string[] = [];
  for (let mm = 1; mm <= 12; mm++) {
    monthIsos.push(`${year}-${String(mm).padStart(2, "0")}-01`);
  }

  const monthRows = monthIsos.map((mi) => {
    const monthBudget = items.reduce(
      (s, it) => s + expectedBudgetForMonth(it, mi),
      0
    );
    const monthSpent = (payments ?? [])
      .filter((p) => p.month === mi)
      .reduce((s, p) => s + Number(p.actual ?? 0), 0);
    return { month: mi, monthBudget, monthSpent };
  });

  const annualBudget = items.reduce((s, it) => s + annualBudgetForItem(it), 0);
  const totalSpent = (payments ?? []).reduce(
    (s, p) => s + Number(p.actual ?? 0),
    0
  );
  const remaining = annualBudget - totalSpent;
  const pctOfBudget =
    annualBudget > 0 ? Math.round((totalSpent / annualBudget) * 100) : 0;
  const paymentCount = (payments ?? []).length;

  const catTotals: Record<string, { budget: number; spent: number }> = {};
  items.forEach((it) => {
    if (!catTotals[it.category]) catTotals[it.category] = { budget: 0, spent: 0 };
    catTotals[it.category].budget += annualBudgetForItem(it);
  });
  const itemCategoryMap = new Map(items.map((it) => [it.id, it.category]));
  (payments ?? []).forEach((p) => {
    const cat = itemCategoryMap.get(p.item_id);
    if (!cat) return;
    if (!catTotals[cat]) catTotals[cat] = { budget: 0, spent: 0 };
    catTotals[cat].spent += Number(p.actual ?? 0);
  });

  const itemSpend = new Map<string, number>();
  (payments ?? []).forEach((p) => {
    itemSpend.set(
      p.item_id,
      (itemSpend.get(p.item_id) ?? 0) + Number(p.actual ?? 0)
    );
  });
  const topItems = items
    .map((it) => ({ ...it, spent: itemSpend.get(it.id) ?? 0 }))
    .filter((x) => x.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments · Dashboard</h1>
        <p className="text-sm text-zinc-500">Year {year}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs current="dashboard" />
        <div className="flex items-center gap-2">
          <YearNav year={year} />
          <Link
            href={`/api/export/payments?year=${year}`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" /> CSV
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Annual budget"
          value={fmtMoney(annualBudget)}
          hint="Expected full year"
        />
        <KpiCard
          label="Spent"
          value={fmtMoney(totalSpent)}
          tone="success"
          hint={`${pctOfBudget}% of budget`}
        />
        <KpiCard
          label="Remaining"
          value={fmtMoney(Math.abs(remaining))}
          tone={remaining >= 0 ? "success" : "danger"}
          hint={remaining >= 0 ? "Left in budget" : "Over budget"}
        />
        <KpiCard
          label="Payments made"
          value={paymentCount}
          hint="Across the year"
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No items defined"
          hint="Add items in the Monthly tab first."
        />
      ) : (
        <ExpensesCharts monthRows={monthRows} catTotals={catTotals} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Month-by-month</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 pr-4 text-right">Budget</th>
                <th className="pb-2 pr-4 text-right">Spent</th>
                <th className="pb-2 pr-4 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r) => {
                const variance = r.monthBudget - r.monthSpent;
                return (
                  <tr
                    key={r.month}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="py-2 pr-4">
                      {new Date(r.month).toLocaleString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtMoney(r.monthBudget)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtMoney(r.monthSpent)}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right tabular-nums ${
                        variance >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {variance >= 0 ? "" : "-"}
                      {fmtMoney(Math.abs(variance))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4 text-right">Annual budget</th>
                <th className="pb-2 pr-4 text-right">Spent</th>
                <th className="pb-2 pr-4 text-right">Remaining</th>
                <th className="pb-2 pr-4 text-right">% used</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(catTotals)
                .filter(([, v]) => v.budget > 0 || v.spent > 0)
                .sort((a, b) => b[1].spent - a[1].spent)
                .map(([cat, v]) => {
                  const rem = v.budget - v.spent;
                  const pct = v.budget > 0 ? Math.round((v.spent / v.budget) * 100) : 0;
                  return (
                    <tr
                      key={cat}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="py-2 pr-4">{cat}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {fmtMoney(v.budget)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {fmtMoney(v.spent)}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right tabular-nums ${
                          rem >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {rem >= 0 ? "" : "-"}
                        {fmtMoney(Math.abs(rem))}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{pct}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top items by spend</CardTitle>
        </CardHeader>
        <CardContent>
          {topItems.length === 0 ? (
            <EmptyState title="No payments yet this year" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Frequency</th>
                  <th className="pb-2 pr-4 text-right">Spent (year)</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((it) => (
                  <tr
                    key={it.id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="py-2 pr-4 font-medium">{it.name}</td>
                    <td className="py-2 pr-4 text-zinc-500">{it.category}</td>
                    <td className="py-2 pr-4 text-zinc-500">{it.frequency}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtMoney(it.spent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
