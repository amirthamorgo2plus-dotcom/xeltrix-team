"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { TIER_META, type TieredCustomer } from "@/lib/customer-tiers";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

// Compact rupees for axis ticks: ₹1.2Cr / ₹20.1L / ₹8.5k
function compactINR(v: number): string {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${Math.round(v / 1e3)}k`;
  return `₹${Math.round(v)}`;
}

type Point = {
  customer: string;
  marginPct: number;
  profit: number;
  revenue: number;
  tier: TieredCustomer["tier"];
};

/**
 * Margin against profit, one dot per customer.
 *
 * The two reference lines ARE the tiers — a dot's quadrant names it, so colour
 * is not asked to carry five categories (five hues cannot be told apart in a
 * scatter; the palette check fails past three). Colour is kept for the one
 * distinction worth calling out: Champions, and the loss-makers listed below.
 *
 * Profit uses a log axis because it spans ₹40 to ₹11.6L — on a linear axis every
 * customer but the largest collapses onto zero. A log axis cannot show negative
 * values, so loss-making customers are listed beneath rather than plotted.
 */
export function TierScatter({
  customers,
  benchmarkPct,
  majorCutoff,
}: {
  customers: TieredCustomer[];
  benchmarkPct: number;
  majorCutoff: number;
}) {
  // Customers whose costs are largely unknown are not plotted: a missing cost
  // reads as 100% margin and would sit top-right, exactly where "reward them"
  // lives.
  const unknown = customers.filter((c) => c.tier === "unknown");
  const measurable = customers.filter((c) => c.tier !== "unknown");
  const earners = measurable.filter((c) => c.profit > 0);
  const losers = measurable
    .filter((c) => c.profit < 0)
    .sort((a, b) => a.profit - b.profit);

  const champions: Point[] = [];
  const others: Point[] = [];
  for (const c of earners) {
    const p: Point = {
      customer: c.customer,
      marginPct: c.marginPct ?? 0,
      profit: c.profit,
      revenue: c.revenue,
      tier: c.tier,
    };
    (c.tier === "champion" ? champions : others).push(p);
  }

  if (earners.length === 0) {
    return <p className="text-sm text-zinc-500">No profitable customers in this range.</p>;
  }

  const profits = earners.map((c) => c.profit);
  const yMin = Math.max(1, Math.min(...profits) * 0.7);
  const yMax = Math.max(...profits) * 1.4;
  const margins = earners.map((c) => c.marginPct ?? 0);
  const xMin = Math.floor(Math.min(...margins, benchmarkPct) - 5);
  const xMax = Math.ceil(Math.max(...margins, benchmarkPct) + 5);

  return (
    <div className="flex flex-col gap-3">
      {/* Legend — two colours, each also named in the quadrant labels */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: TIER_META.champion.color }}
          />
          Champions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: TIER_META.big_thin.color }}
          />
          Everyone else
        </span>
        <span className="text-zinc-500">
          Quadrants split at {Math.round(benchmarkPct * 10) / 10}% margin (your average) and{" "}
          {fmt(majorCutoff)} profit (top 80%)
        </span>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 20, bottom: 28, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              type="number"
              dataKey="marginPct"
              name="Margin"
              domain={[xMin, xMax]}
              tickFormatter={(v) => `${Math.round(Number(v))}%`}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              label={{
                value: "Gross margin",
                position: "insideBottom",
                offset: -16,
                fill: "#a1a1aa",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="profit"
              name="Profit"
              scale="log"
              domain={[yMin, yMax]}
              allowDataOverflow
              tickFormatter={(v) => compactINR(Number(v))}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              tickLine={false}
              axisLine={false}
              width={62}
            />
            <ZAxis type="number" dataKey="revenue" range={[60, 320]} name="Revenue" />

            {/* The quadrant dividers — these, not colour, carry the tiers */}
            <ReferenceLine
              x={benchmarkPct}
              stroke="#52525b"
              strokeDasharray="4 4"
              label={{ value: "your avg margin", position: "top", fill: "#71717a", fontSize: 10 }}
            />
            <ReferenceLine
              y={majorCutoff}
              stroke="#52525b"
              strokeDasharray="4 4"
              label={{ value: "top 80% of profit", position: "right", fill: "#71717a", fontSize: 10 }}
            />

            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "#3f3f46" }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0].payload as Point;
                const meta = TIER_META[p.tier];
                return (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 max-w-[240px] font-medium text-zinc-200">
                      {p.customer}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Gross profit</span>
                      <span className="tabular-nums text-zinc-100">{fmt(p.profit)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Margin</span>
                      <span className="tabular-nums text-zinc-100">
                        {Math.round(p.marginPct)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-400">Revenue</span>
                      <span className="tabular-nums text-zinc-100">{fmt(p.revenue)}</span>
                    </div>
                    <div className="mt-1 border-t border-zinc-700 pt-1 text-zinc-300">
                      {meta.label} — {meta.action.toLowerCase()}
                    </div>
                  </div>
                );
              }}
            />

            <Scatter
              name="Everyone else"
              data={others}
              fill={TIER_META.big_thin.color}
              fillOpacity={0.75}
              isAnimationActive={false}
            />
            <Scatter
              name="Champions"
              data={champions}
              fill={TIER_META.champion.color}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-zinc-500">
        Dot size is revenue. Profit uses a log scale — one customer earns more than all
        the rest combined, so a linear axis would flatten everyone else onto zero.
      </p>

      {unknown.length > 0 && (
        <div className="rounded-md border border-zinc-700/60 bg-zinc-800/30 p-3">
          <p className="text-xs font-medium text-zinc-400">
            {unknown.length} customer{unknown.length === 1 ? "" : "s"} not plotted — too
            few of their products have a cost price, so their margin cannot be trusted
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            {unknown
              .slice()
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 8)
              .map((c) => (
                <li key={c.customer}>
                  <span className="text-zinc-400">{c.customer}</span>{" "}
                  <span className="tabular-nums">{fmt(c.revenue)} revenue</span>
                </li>
              ))}
            {unknown.length > 8 && <li>+{unknown.length - 8} more</li>}
          </ul>
        </div>
      )}

      {losers.length > 0 && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs font-medium" style={{ color: TIER_META.losing.color }}>
            {losers.length} customer{losers.length === 1 ? "" : "s"} sold below cost — not
            plottable on a log axis
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
            {losers.map((c) => (
              <li key={c.customer}>
                <span className="text-zinc-300">{c.customer}</span>{" "}
                <span className="tabular-nums" style={{ color: TIER_META.losing.color }}>
                  {fmt(c.profit)}
                </span>{" "}
                <span className="text-zinc-600">
                  ({Math.round(c.marginPct ?? 0)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
