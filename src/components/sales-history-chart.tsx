"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { month: string; label: string; sales: number };

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
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            formatter={(v) => [fmtFull(Number(v)), "Sales (excl. tax)"]}
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
              fontSize: 12,
              color: "#e4e4e7",
            }}
            labelStyle={{ color: "#a1a1aa" }}
            cursor={{ stroke: "#3f3f46" }}
          />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#b5c76a"
            strokeWidth={2}
            dot={{ r: 3, fill: "#b5c76a", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
