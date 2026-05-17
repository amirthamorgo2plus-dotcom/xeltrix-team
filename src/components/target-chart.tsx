"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; target: number; achieved: number };

export function TargetChart({ data, currency }: { data: Row[]; currency: string }) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => fmt(Number(v))} tick={{ fontSize: 11 }} width={90} />
          <Tooltip formatter={(v) => fmt(Number(v))} />
          <Legend />
          <Bar dataKey="target" fill="#a1a1aa" name="Target" />
          <Bar dataKey="achieved" fill="#10b981" name="Achieved" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
