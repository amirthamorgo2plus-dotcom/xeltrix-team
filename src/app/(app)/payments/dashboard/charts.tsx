"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney } from "../helpers";

const PALETTE = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#f97316", "#84cc16",
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ExpensesCharts({
  monthRows,
  catTotals,
}: {
  monthRows: { month: string; monthBudget: number; monthSpent: number }[];
  catTotals: Record<string, { budget: number; spent: number }>;
}) {
  const barData = monthRows.map((r, i) => ({
    name: SHORT_MONTHS[i],
    Budget: r.monthBudget,
    Spent: r.monthSpent,
  }));

  const pieData = Object.entries(catTotals)
    .filter(([, v]) => v.spent > 0)
    .map(([cat, v]) => ({ name: cat, value: v.spent }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Budget vs Spent (monthly)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => fmtMoney(Number(v))} tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                <Legend />
                <Bar dataKey="Budget" fill="#a1a1aa" />
                <Bar dataKey="Spent" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spend by category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                No spend yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={1}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
