"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TIER_META, type TierKey, type TierSummary } from "@/lib/customer-tiers";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

function compactINR(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${sign}₹${Math.round(a / 1e3)}k`;
  return `${sign}₹${Math.round(a)}`;
}

/**
 * Gross profit by tier.
 *
 * Replaces a margin-vs-profit scatter. The reader's job here is "which group
 * matters and what do I do about it" — that is comparing magnitude, which is a
 * bar's job; a scatter answers how two measures relate, which nobody asked.
 *
 * Bars are also an adjacent-pair form, so all five ranked tiers keep their own
 * colour (a scatter caps at three before hues stop being distinguishable).
 * Horizontal because the tier names are long, and every bar is directly
 * labelled so the small tiers stay readable next to a dominant one.
 */
export function TierBars({ summary }: { summary: TierSummary[] }) {
  const shown = summary.filter((t) => t.customers > 0);
  if (shown.length === 0) return null;

  const data = shown.map((t) => ({
    tier: t.tier,
    label: TIER_META[t.tier].label,
    profit: Math.round(t.profit),
    customers: t.customers,
    revenue: t.revenue,
    action: TIER_META[t.tier].action,
  }));

  const hasNegative = data.some((d) => d.profit < 0);
  // Recharts would otherwise pad the negative side to a round number far below
  // the actual minimum — a -₹8k bar should not buy a -₹4L axis.
  const maxProfit = Math.max(...data.map((d) => d.profit), 0);
  const minProfit = Math.min(...data.map((d) => d.profit), 0);
  const domain: [number, number] = [
    minProfit < 0 ? minProfit * 1.6 : 0,
    maxProfit * 1.12,
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 76, bottom: 4, left: 8 }}
            barCategoryGap={10}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
            <XAxis
              type="number"
              domain={domain}
              allowDataOverflow
              tickFormatter={(v) => compactINR(Number(v))}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={118}
              tick={{ fontSize: 12, fill: "#d4d4d8" }}
              tickLine={false}
              axisLine={false}
            />
            {hasNegative && <ReferenceLine x={0} stroke="#52525b" />}
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-medium text-zinc-200">{d.label}</div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Customers</span>
                      <span className="tabular-nums text-zinc-100">{d.customers}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Revenue</span>
                      <span className="tabular-nums text-zinc-100">{fmt(d.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Gross profit</span>
                      <span className="tabular-nums text-zinc-100">{fmt(d.profit)}</span>
                    </div>
                    <div className="mt-1 border-t border-zinc-700 pt-1 text-zinc-300">
                      {d.action}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="profit" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.tier} fill={TIER_META[d.tier as TierKey].color} />
              ))}
              {/* Direct-labelled, so a tier earning ₹37k stays readable beside one
                  earning ₹11.6L. */}
              {/* A negative bar grows leftward from zero, so x+width is the zero
                  line. Labelling there keeps a loss-making tier's figure in the
                  empty space right of zero instead of on the category name. */}
              <LabelList
                dataKey="profit"
                content={(props) => {
                  const { x, y, width, height, value } = props as {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    value: number;
                  };
                  return (
                    <text
                      x={x + width + 8}
                      y={y + height / 2}
                      textAnchor="start"
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight={600}
                      fill="#e4e4e7"
                    >
                      {compactINR(Number(value))}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Each tier named with its count and what to do — identity never by colour alone */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
        {data.map((d) => (
          <div key={d.tier} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: TIER_META[d.tier as TierKey].color }}
            />
            <span className="text-zinc-300">{d.label}</span>
            <span className="text-zinc-500">
              {d.customers} · {d.action.toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
