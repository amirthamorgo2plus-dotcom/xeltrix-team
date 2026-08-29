"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { CATEGORY_META, CATEGORY_ORDER, type ItemCategory } from "@/lib/item-category";

type Mix = Record<ItemCategory, number> & { total: number };

export function SalesMixBreakdown({ mix, currency }: { mix: Mix; currency: string }) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  const slices = CATEGORY_ORDER.map((k) => ({
    key: k,
    label: CATEGORY_META[k].label,
    color: CATEGORY_META[k].color,
    value: mix[k],
    pct: mix.total > 0 ? (mix[k] / mix.total) * 100 : 0,
  })).filter((s) => s.value > 0);

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={62}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Total</span>
          <span className="text-sm font-semibold tabular-nums text-zinc-100">{fmt(mix.total)}</span>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-zinc-300">{s.label}</span>
            <span className="ml-auto tabular-nums text-zinc-400">{fmt(s.value)}</span>
            <span className="w-12 text-right tabular-nums text-zinc-500">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
