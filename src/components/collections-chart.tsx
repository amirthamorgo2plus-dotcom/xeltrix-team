"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  name: string;
  current: number;
  "1-15": number;
  "16-30": number;
  "31-45": number;
  "45+": number;
  total: number;
};

const BUCKETS: { key: keyof Omit<Row, "name" | "total">; label: string; color: string }[] = [
  { key: "current", label: "Current",    color: "#b5c76a" },
  { key: "1-15",    label: "1–15 days",  color: "#eab308" },
  { key: "16-30",   label: "16–30 days", color: "#f97316" },
  { key: "31-45",   label: "31–45 days", color: "#ef4444" },
  { key: "45+",     label: ">45 days",   color: "#7f1d1d" },
];

export function CollectionsChart({ data, currency }: { data: Row[]; currency: string }) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);

  // Height scales with number of people so bars aren't squished
  const barHeight = 36;
  const chartH = Math.max(220, data.length * barHeight + 60);

  return (
    <div style={{ height: chartH }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          barSize={22}
        >
          <XAxis
            type="number"
            tickFormatter={(v) => fmt(Number(v))}
            tick={{ fontSize: 10, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 12, fill: "#d4d4d8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#f4f4f5", fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: "#d4d4d8" }}
            formatter={(v, name) => [fmt(Number(v)), name]}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#a1a1aa", paddingTop: 6 }}
            iconType="square"
            iconSize={10}
          />
          {BUCKETS.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              stackId="a"
              fill={b.color}
              radius={
                i === 0
                  ? [4, 0, 0, 4]
                  : i === BUCKETS.length - 1
                    ? [0, 4, 4, 0]
                    : [0, 0, 0, 0]
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
