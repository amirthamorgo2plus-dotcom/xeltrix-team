import { redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { MonthNav } from "./month-nav";
import { ReminderBanner } from "./reminder-banner";
import { ItemRow } from "./item-row";
import { ItemForm } from "./item-form";
import { ActionsBar } from "./actions-bar";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const m = await getMyMembership();
  if (!m || !isAdminOrManager(m.role)) redirect("/dashboard");
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const sp = await searchParams;
  const now = new Date();
  const monthCursor = sp.month ? `${sp.month}-01` : monthIso(now);
  const monthCursorYm = monthCursor.slice(0, 7);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;

  const supabase = await createClient();
  const [{ data: itemsRaw }, { data: payments }] = await Promise.all([
    supabase
      .from("expense_items")
      .select(
        "id, name, category, frequency, budget, due_day, due_month, reminder_days, notes, active"
      )
      .eq("team_id", teamId)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("expense_payments")
      .select("item_id, month, actual, paid_on")
      .eq("team_id", teamId)
      .eq("month", monthCursor),
  ]);

  const items: ExpenseItem[] = (itemsRaw ?? []) as ExpenseItem[];
  const paidMap = new Map<string, ExpensePayment>(
    (payments ?? []).map((p) => [p.item_id, p as ExpensePayment])
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader monthCursor={monthCursor} />
        <Tabs current="monthly" monthCursor={monthCursorYm} />
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No recurring expenses defined yet. Seed the default 21 items across 7 categories
              (rent, electricity, salaries, GST, etc.) — you can edit or delete any of them later.
            </p>
            <ItemForm mode="seed-or-add" categories={Array.from(CATEGORIES)} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const grouped: Record<string, ExpenseItem[]> = {};
  CATEGORIES.forEach((c) => (grouped[c] = []));
  items.forEach((it) => {
    if (!grouped[it.category]) grouped[it.category] = [];
    grouped[it.category].push(it);
  });

  const totalItems = items.length;
  const paidCount = items.filter((it) => paidMap.has(it.id)).length;
  const budget = items.reduce(
    (s, it) => s + expectedBudgetForMonth(it, monthCursor),
    0
  );
  const spent = items.reduce(
    (s, it) => s + Number(paidMap.get(it.id)?.actual ?? 0),
    0
  );
  const variance = budget - spent;
  const pctDone =
    totalItems > 0 ? Math.round((paidCount / totalItems) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader monthCursor={monthCursor} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs current="monthly" monthCursor={monthCursorYm} />
        <div className="flex items-center gap-2">
          <MonthNav monthCursorYm={monthCursorYm} />
          <Link
            href={`/api/export/payments?year=${monthCursorYm.slice(0, 4)}`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" /> CSV
          </Link>
        </div>
      </div>

      <ReminderBanner
        items={items}
        paidMap={paidMap}
        monthCursor={monthCursor}
        today={today}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Items paid"
          value={`${paidCount} / ${totalItems}`}
          hint={`${pctDone}% done`}
        />
        <KpiCard label="Budget" value={fmtMoney(budget)} hint="Expected this month" />
        <KpiCard
          label="Spent"
          value={fmtMoney(spent)}
          tone="success"
          hint="Actual paid"
        />
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
        const catBudget = list.reduce(
          (s, it) => s + expectedBudgetForMonth(it, monthCursor),
          0
        );
        const catSpent = list.reduce(
          (s, it) => s + Number(paidMap.get(it.id)?.actual ?? 0),
          0
        );
        const catPaid = list.filter((it) => paidMap.has(it.id)).length;
        return (
          <section
            key={cat}
            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {cat}
                </span>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {catPaid}/{list.length}
                </span>
              </div>
              <span className="text-xs tabular-nums text-zinc-500">
                {fmtMoney(catSpent)} / {fmtMoney(catBudget)}
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {list.map((it) => {
                const pmt = paidMap.get(it.id);
                return (
                  <ItemRow
                    key={it.id}
                    item={it}
                    paid={!!pmt}
                    paidActual={Number(pmt?.actual ?? 0)}
                    paidOn={pmt?.paid_on ?? null}
                    expected={expectedBudgetForMonth(it, monthCursor)}
                    monthCursor={monthCursor}
                    categories={Array.from(CATEGORIES)}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

      <ActionsBar monthCursor={monthCursor} />
    </div>
  );
}

function PageHeader({ monthCursor }: { monthCursor: string }) {
  const label = new Date(monthCursor).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
      <p className="text-sm text-zinc-500">
        Recurring company expenses · {label}
      </p>
    </div>
  );
}
