import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import {
  CATEGORIES,
  fmtMoney,
  monthIso,
  expectedBudgetForMonth,
  type ExpenseItem,
  type ExpensePayment,
} from "./helpers";
import { Tabs } from "./tabs";
import { PaidToggle } from "./paid-toggle";
import { ItemForm } from "./item-form";
import { ActionsBar } from "./actions-bar";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) redirect("/dashboard");

  const sp = await searchParams;
  const now = new Date();
  const monthCursor = sp.month
    ? `${sp.month}-01`
    : monthIso(now);

  const supabase = await createClient();

  // Fetch items + payments for the selected month
  const [{ data: itemsRaw }, { data: payments }] = await Promise.all([
    supabase
      .from("expense_items")
      .select("id, name, category, frequency, budget, due_day, due_month, reminder_days, notes, active")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("expense_payments")
      .select("item_id, month, actual, paid_on")
      .eq("month", monthCursor),
  ]);

  const items: ExpenseItem[] = (itemsRaw ?? []) as ExpenseItem[];
  const paidMap = new Map<string, ExpensePayment>(
    (payments ?? []).map((p) => [p.item_id, p as ExpensePayment])
  );

  // Bootstrap: if there are no items at all, suggest seeding
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader monthCursor={monthCursor} />
        <Tabs current="monthly" />
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No recurring expenses defined yet. Seed the default 21 items across 7 categories
              (rent, electricity, salaries, GST, etc.) — you can edit or delete any of them later.
            </p>
            <ItemForm
              mode="seed-or-add"
              categories={Array.from(CATEGORIES)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group items by category
  const grouped: Record<string, ExpenseItem[]> = {};
  CATEGORIES.forEach((c) => (grouped[c] = []));
  items.forEach((it) => {
    if (!grouped[it.category]) grouped[it.category] = [];
    grouped[it.category].push(it);
  });

  // KPIs
  const totalItems = items.length;
  const paidCount = items.filter((it) => paidMap.has(it.id)).length;
  const budget = items.reduce((s, it) => s + expectedBudgetForMonth(it, monthCursor), 0);
  const spent = items.reduce(
    (s, it) => s + Number(paidMap.get(it.id)?.actual ?? 0),
    0
  );
  const variance = budget - spent;
  const pctDone = totalItems > 0 ? Math.round((paidCount / totalItems) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader monthCursor={monthCursor} />
      <Tabs current="monthly" monthCursor={monthCursor.slice(0, 7)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Items paid"
          value={`${paidCount} / ${totalItems}`}
          hint={`${pctDone}% done`}
        />
        <KpiCard label="Budget" value={fmtMoney(budget)} hint="Expected this month" />
        <KpiCard label="Spent" value={fmtMoney(spent)} tone="success" hint="Actual paid" />
        <KpiCard
          label="Variance"
          value={fmtMoney(Math.abs(variance))}
          tone={variance >= 0 ? "success" : "danger"}
          hint={variance >= 0 ? "Under budget" : "Over budget"}
        />
      </div>

      <ItemForm categories={Array.from(CATEGORIES)} mode="add" />

      {CATEGORIES.map((cat) => {
        const list = grouped[cat] ?? [];
        if (list.length === 0) return null;
        const catBudget = list.reduce((s, it) => s + expectedBudgetForMonth(it, monthCursor), 0);
        const catSpent = list.reduce(
          (s, it) => s + Number(paidMap.get(it.id)?.actual ?? 0),
          0
        );
        return (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {cat}
                </span>
                <span className="text-xs font-normal text-zinc-500">
                  {fmtMoney(catSpent)} / {fmtMoney(catBudget)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {list.map((it) => {
                  const pmt = paidMap.get(it.id);
                  const expected = expectedBudgetForMonth(it, monthCursor);
                  return (
                    <li
                      key={it.id}
                      className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                        pmt
                          ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
                          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                      }`}
                    >
                      <PaidToggle
                        itemId={it.id}
                        itemName={it.name}
                        defaultBudget={Number(it.budget) || 0}
                        monthIso={monthCursor}
                        paid={!!pmt}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={`truncate text-sm ${
                            pmt ? "text-zinc-500 line-through" : "font-medium"
                          }`}
                          title={it.name}
                        >
                          {it.name}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {pmt ? (
                            <>
                              Paid {fmtMoney(Number(pmt.actual))}
                              {pmt.paid_on
                                ? ` on ${format(new Date(pmt.paid_on), "dd MMM")}`
                                : ""}
                            </>
                          ) : expected > 0 ? (
                            <>Budget: {fmtMoney(expected)} · Due day {it.due_day}</>
                          ) : (
                            <>No budget set · Due day {it.due_day}</>
                          )}
                        </span>
                      </div>
                      <Badge tone="muted">{it.frequency}</Badge>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <ActionsBar monthCursor={monthCursor} />
    </div>
  );
}

function PageHeader({ monthCursor }: { monthCursor: string }) {
  const label = format(new Date(monthCursor), "MMMM yyyy");
  return (
    <div>
      <h1 className="text-2xl font-semibold">Payments</h1>
      <p className="text-sm text-zinc-500">
        Recurring company expenses · {label}
      </p>
    </div>
  );
}
