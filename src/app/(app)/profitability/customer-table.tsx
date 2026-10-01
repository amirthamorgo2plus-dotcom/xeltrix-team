"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TIER_META, type TierKey } from "@/lib/customer-tiers";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

export type CustomerInvoice = {
  id: string;
  number: string;
  date: string | null;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
};

export type CustomerSummaryRow = {
  customer: string;
  tier: TierKey | null;
  invoices: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
};

// A customer row opens to the invoices behind it. "THULIR loses ₹3,854" is the
// question; "which of their 13 invoices" is the answer, and the total alone
// never shows whether it is every order or one bad one.
export function CustomerTable({
  rows,
  invoicesByCustomer,
}: {
  rows: CustomerSummaryRow[];
  invoicesByCustomer: Record<string, CustomerInvoice[]>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="pb-2 pr-3">Customer</th>
            <th className="pb-2 pr-3">Tier</th>
            <th className="pb-2 pr-3 text-right">Invoices</th>
            <th className="pb-2 pr-3 text-right">Revenue</th>
            <th className="pb-2 pr-3 text-right">Cost</th>
            <th className="pb-2 pr-3 text-right">Gross profit</th>
            <th className="pb-2 text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const loss = c.revenue > 0 && c.profit < 0;
            const expanded = open === c.customer;
            const invoices = invoicesByCustomer[c.customer] ?? [];
            return (
              <>
                <tr
                  key={c.customer}
                  className="cursor-pointer border-t border-zinc-200 hover:bg-zinc-800/20 dark:border-zinc-800"
                  onClick={() => setOpen(expanded ? null : c.customer)}
                >
                  <td className="max-w-[280px] py-2 pr-3 font-medium">
                    <span className="flex items-center gap-1.5">
                      {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      )}
                      <span className="truncate">{c.customer}</span>
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {c.tier ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-400">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: TIER_META[c.tier].color }}
                        />
                        {TIER_META[c.tier].label}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">
                    {c.invoices}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(c.revenue)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">
                    {fmt(c.cost)}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-medium tabular-nums ${
                      loss ? "text-red-400" : "text-[#b5c76a]"
                    }`}
                  >
                    {fmt(c.profit)}
                  </td>
                  <td className="py-2 text-right">
                    {c.marginPct == null ? (
                      <span className="text-zinc-600">—</span>
                    ) : (
                      <Badge tone={loss ? "danger" : c.marginPct < 10 ? "warning" : "success"}>
                        {Math.round(c.marginPct)}%
                      </Badge>
                    )}
                  </td>
                </tr>

                {expanded && (
                  <tr
                    key={`${c.customer}-inv`}
                    className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
                  >
                    <td colSpan={7} className="px-3 py-3">
                      {c.tier && (
                        <p className="mb-2 text-xs text-zinc-500">
                          <span className="text-zinc-300">{TIER_META[c.tier].label}</span> —{" "}
                          {TIER_META[c.tier].blurb}
                        </p>
                      )}
                      {invoices.length === 0 ? (
                        <p className="text-xs text-zinc-500">No invoices to show.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="text-left uppercase text-zinc-500">
                            <tr>
                              <th className="pb-1.5 pr-3">Invoice</th>
                              <th className="pb-1.5 pr-3">Date</th>
                              <th className="pb-1.5 pr-3 text-right">Revenue</th>
                              <th className="pb-1.5 pr-3 text-right">Cost</th>
                              <th className="pb-1.5 pr-3 text-right">Gross profit</th>
                              <th className="pb-1.5 text-right">Margin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((inv) => {
                              const iLoss = inv.revenue > 0 && inv.profit < 0;
                              return (
                                <tr
                                  key={inv.id}
                                  className="border-t border-zinc-200/60 dark:border-zinc-800/60"
                                >
                                  <td className="py-1.5 pr-3 text-zinc-200">{inv.number}</td>
                                  <td className="py-1.5 pr-3 text-zinc-500">
                                    {inv.date ? format(parseISO(inv.date), "dd MMM yyyy") : "—"}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums">
                                    {fmt(inv.revenue)}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-400">
                                    {fmt(inv.cost)}
                                  </td>
                                  <td
                                    className={`py-1.5 pr-3 text-right font-medium tabular-nums ${
                                      iLoss ? "text-red-400" : "text-[#b5c76a]"
                                    }`}
                                  >
                                    {fmt(inv.profit)}
                                  </td>
                                  <td
                                    className={`py-1.5 text-right tabular-nums ${
                                      iLoss ? "text-red-400" : "text-zinc-400"
                                    }`}
                                  >
                                    {inv.marginPct == null
                                      ? "—"
                                      : `${Math.round(inv.marginPct)}%`}
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
