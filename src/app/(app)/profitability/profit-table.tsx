"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

export type ProfitLine = {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
  /** Null when no cost price is known for the product. */
  unitCost: number | null;
};

export type ProfitRow = {
  id: string;
  number: string;
  date: string | null;
  customer: string | null;
  revenue: number;
  cost: number;
  uncosted: number;
  profit: number;
  marginPct: number | null;
};

// Rows expand to the line items behind the figure. A loss is almost always one
// bad line rather than the whole invoice, and the total alone never shows which.
export function ProfitTable({
  rows,
  linesByInvoice,
}: {
  rows: ProfitRow[];
  linesByInvoice: Record<string, ProfitLine[]>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="pb-2 pr-3">Invoice</th>
            <th className="pb-2 pr-3">Customer</th>
            <th className="pb-2 pr-3">Date</th>
            <th className="pb-2 pr-3 text-right">Revenue</th>
            <th className="pb-2 pr-3 text-right">Cost</th>
            <th className="pb-2 pr-3 text-right">Gross profit</th>
            <th className="pb-2 text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const loss = r.revenue > 0 && r.profit < 0;
            const expanded = open === r.id;
            const lines = linesByInvoice[r.id] ?? [];
            return (
              <>
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-zinc-200 hover:bg-zinc-800/20 dark:border-zinc-800"
                  onClick={() => setOpen(expanded ? null : r.id)}
                >
                  <td className="py-2 pr-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                      )}
                      {r.number}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate py-2 pr-3 text-zinc-300">
                    {r.customer ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-500">
                    {r.date ? format(parseISO(r.date), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(r.revenue)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">
                    {fmt(r.cost)}
                    {r.uncosted > 0 && r.revenue > 0 && (
                      <span
                        className="ml-1 text-[10px] text-amber-500"
                        title={`${fmt(r.uncosted)} of this invoice has no cost price`}
                      >
                        partial
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-medium tabular-nums ${
                      loss ? "text-red-400" : "text-[#b5c76a]"
                    }`}
                  >
                    {fmt(r.profit)}
                  </td>
                  <td className="py-2 text-right">
                    {r.marginPct == null ? (
                      <span className="text-zinc-600">—</span>
                    ) : (
                      <Badge tone={loss ? "danger" : r.marginPct < 10 ? "warning" : "success"}>
                        {Math.round(r.marginPct)}%
                      </Badge>
                    )}
                  </td>
                </tr>

                {expanded && (
                  <tr
                    key={`${r.id}-lines`}
                    className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <td colSpan={7} className="px-3 py-3">
                      {lines.length === 0 ? (
                        <p className="text-xs text-zinc-500">
                          No line items mirrored for this invoice.
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="text-left uppercase text-zinc-500">
                            <tr>
                              <th className="pb-1.5 pr-3">Item</th>
                              <th className="pb-1.5 pr-3 text-right">Qty</th>
                              <th className="pb-1.5 pr-3 text-right">Sold at</th>
                              <th className="pb-1.5 pr-3 text-right">Revenue</th>
                              <th className="pb-1.5 pr-3 text-right">Cost / unit</th>
                              <th className="pb-1.5 pr-3 text-right">Line cost</th>
                              <th className="pb-1.5 text-right">Line profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((l, i) => {
                              const rev = Number(l.amount ?? 0);
                              const qty = Number(l.quantity ?? 0);
                              const lineCost = l.unitCost == null ? null : l.unitCost * qty;
                              const lineProfit = lineCost == null ? null : rev - lineCost;
                              return (
                                <tr
                                  key={i}
                                  className="border-t border-zinc-200/60 dark:border-zinc-800/60"
                                >
                                  <td className="max-w-[280px] truncate py-1.5 pr-3 text-zinc-200">
                                    {l.name ?? "—"}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-400">
                                    {qty}
                                    {l.unit ? ` ${l.unit}` : ""}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-400">
                                    {l.rate != null ? fmt(Number(l.rate)) : "—"}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">
                                    {fmt(rev)}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-400">
                                    {l.unitCost == null ? (
                                      <span className="text-amber-500">no cost</span>
                                    ) : (
                                      fmt(l.unitCost)
                                    )}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-400">
                                    {lineCost == null ? "—" : fmt(lineCost)}
                                  </td>
                                  <td
                                    className={`py-1.5 text-right font-medium tabular-nums ${
                                      lineProfit == null
                                        ? "text-zinc-600"
                                        : lineProfit < 0
                                          ? "text-red-400"
                                          : "text-[#b5c76a]"
                                    }`}
                                  >
                                    {lineProfit == null ? "—" : fmt(lineProfit)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
