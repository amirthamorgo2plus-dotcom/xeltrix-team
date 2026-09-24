"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { SalesHistoryChart, type Row } from "@/components/sales-history-chart";
import { CATEGORY_META, CATEGORY_ORDER, type ItemCategory } from "@/lib/item-category";

// One month-on-month chart with a product-type switch, rather than a separate
// card per type. Every category is already present on each row, so switching is
// instant — no refetch and no page reload.
export function ProductTypeSalesCard({
  data,
  currency,
  defaultCategory = "manufactured",
}: {
  data: Row[];
  currency: string;
  defaultCategory?: ItemCategory;
}) {
  // Only offer types that actually sold in the window.
  const available = useMemo(
    () => CATEGORY_ORDER.filter((c) => data.some((row) => row[c] > 0)),
    [data]
  );

  const [selected, setSelected] = useState<ItemCategory>(
    available.includes(defaultCategory) ? defaultCategory : (available[0] ?? "manufactured")
  );

  // Restate `total` as the selected type so the on-chart labels and the tooltip
  // report that figure rather than the all-category total.
  const rows = useMemo(
    () => data.map((m) => ({ ...m, total: m[selected] })),
    [data, selected]
  );
  const categories = useMemo(() => [selected], [selected]);
  const hasData = rows.some((m) => m.total > 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{CATEGORY_META[selected].label} Sales (last 12 months)</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">excl. tax</span>
          <div className="inline-flex flex-wrap rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
            {available.map((c) => {
              const active = c === selected;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(c)}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: CATEGORY_META[c].color }}
                  />
                  {CATEGORY_META[c].label}
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <SalesHistoryChart data={rows} currency={currency} categories={categories} />
        ) : (
          <EmptyState
            title={`No ${CATEGORY_META[selected].label.toLowerCase()} sales in this window`}
            hint="Invoiced items appear here as they sync from Zoho."
          />
        )}
      </CardContent>
    </Card>
  );
}
