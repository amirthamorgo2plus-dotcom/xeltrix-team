"use client";

import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORY_META, CATEGORY_ORDER, type CategoryMix } from "@/lib/item-category";

type Row = CategoryMix & {
  month: string;
  label: string;
  total: number;
};

// Compact INR for axis ticks: ₹1.2Cr / ₹20.1L / ₹8,500
function compactINR(v: number, currency: string): string {
  const sym = currency === "INR" ? "₹" : "";
  if (v >= 1e7) return `${sym}${(v / 1e7).toFixed(v >= 1e8 ? 0 : 2)}Cr`;
  if (v >= 1e5) return `${sym}${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1e3) return `${sym}${Math.round(v / 1e3)}k`;
  return `${sym}${v}`;
}

export function SalesHistoryChart({ data, currency }: { data: Row[]; currency: string }) {
  const fmtFull = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  // Only categories that actually appear in the window (keeps empty ones like
  // Packing Material out of the legend/stack).
  const activeCats = CATEGORY_ORDER.filter((k) => data.some((row) => row[k] > 0));

  return (
    <div className="flex flex-col gap-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
        {activeCats.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_META[k].color }} />
            {CATEGORY_META[k].label}
          </span>
        ))}
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={{ stroke: "#3f3f46" }} />
            <YAxis
              tickFormatter={(v) => compactINR(Number(v), currency)}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ stroke: "#3f3f46" }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0].payload as Row;
                return (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-medium text-zinc-300">{label}</div>
                    {activeCats.map((k) =>
                      row[k] > 0 ? (
                        <div key={k} className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5 text-zinc-400">
                            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: CATEGORY_META[k].color }} />
                            {CATEGORY_META[k].label}
                          </span>
                          <span className="tabular-nums text-zinc-200">{fmtFull(row[k])}</span>
                        </div>
                      ) : null,
                    )}
                    <div className="mt-1 flex items-center justify-between gap-4 border-t border-zinc-700 pt-1 font-semibold">
                      <span className="text-zinc-300">Total</span>
                      <span className="tabular-nums text-zinc-100">{fmtFull(row.total)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {activeCats.map((k, idx) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stackId="sales"
                stroke={CATEGORY_META[k].color}
                fill={CATEGORY_META[k].color}
                fillOpacity={0.85}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {/* Total sales amount printed on top of each month's stack */}
                {idx === activeCats.length - 1 && (
                  <LabelList
                    dataKey="total"
                    position="top"
                    offset={8}
                    fontSize={10}
                    fontWeight={600}
                    fill="#e4e4e7"
                    formatter={(v) => (Number(v) > 0 ? compactINR(Number(v), currency) : "")}
                  />
                )}
              </Area>
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
