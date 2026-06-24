"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; pending: number };

const COLORS = ["#ef4444", "#f97316", "#eab308", "#e879f9", "#38bdf8", "#34d399", "#a78bfa", "#fb7185"];

export function CollectionsChart({ data, currency }: { data: Row[]; currency: string }) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => fmt(Number(v))} tick={{ fontSize: 11 }} width={90} />
          <Tooltip
            formatter={(v) => [fmt(Number(v)), "Pending"]}
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
          />
          <Bar dataKey="pending" name="Pending" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
