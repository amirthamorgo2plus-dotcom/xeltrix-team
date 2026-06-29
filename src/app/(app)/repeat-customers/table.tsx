"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import type { CustomerStat, ReorderStatus } from "@/lib/repeat-customers";

const STATUS_META: Record<ReorderStatus, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-red-500/15 text-red-400" },
  due_soon: { label: "Due soon", cls: "bg-amber-500/15 text-amber-400" },
  on_track: { label: "On track", cls: "bg-[#b5c76a]/10 text-[#b5c76a]" },
};

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

function waReorderLink(c: CustomerStat): string | null {
  if (!c.phone) return null;
  const cleaned = c.phone.replace(/\D/g, "");
  const num = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
  const msg = encodeURIComponent(
    `Hi ${c.name}, hope you're doing well! It's been about ${c.daysSinceLast} days since your last order. Would you like to place a reorder? Happy to help.`
  );
  return `https://wa.me/${num}?text=${msg}`;
}

type SortKey = "status" | "name" | "orders" | "interval" | "since" | "value";

export function RepeatCustomersTable({
  rows,
  isAdmin,
  currency,
}: {
  rows: CustomerStat[];
  isAdmin: boolean;
  currency: string;
}) {
  const [search, setSearch] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("status");

  const view = useMemo(() => {
    let r = rows;
    if (dueOnly) r = r.filter((c) => c.status !== "on_track");
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((c) => c.name.toLowerCase().includes(q) || (c.salesperson ?? "").toLowerCase().includes(q));
    const order = (s: ReorderStatus) => (s === "overdue" ? 0 : s === "due_soon" ? 1 : 2);
    const sorted = [...r];
    sorted.sort((a, b) => {
      switch (sort) {
        case "name": return a.name.localeCompare(b.name);
        case "orders": return b.orderCount - a.orderCount;
        case "interval": return a.typicalIntervalDays - b.typicalIntervalDays;
        case "since": return b.daysSinceLast - a.daysSinceLast;
        case "value": return b.totalValue - a.totalValue;
        case "status":
        default: return order(a.status) - order(b.status) || b.overdueRatio - a.overdueRatio;
      }
    });
    return sorted;
  }, [rows, search, dueOnly, sort]);

  const th = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <th
      onClick={() => setSort(key)}
      className={`cursor-pointer select-none px-4 py-3 text-${align} text-xs font-medium ${
        sort === key ? "text-[#b5c76a]" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
      {sort === key ? " ↓" : ""}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer or salesperson…"
          className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#b5c76a]/60 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
            className="h-4 w-4 accent-[#b5c76a]"
          />
          Due only
        </label>
        <span className="ml-auto text-xs text-zinc-600">{view.length} customer{view.length !== 1 ? "s" : ""}</span>
      </div>

      {view.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center">
          <p className="text-sm font-medium text-zinc-400">No repeat customers to show</p>
          <p className="mt-1 text-xs text-zinc-600">
            Repeat customers appear once a customer has at least two synced orders.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                {th("status", "Status")}
                {th("name", "Customer")}
                {th("orders", "Orders", "right")}
                {th("interval", "Every (days)", "right")}
                {th("since", "Last order", "right")}
                {th("value", "Total value", "right")}
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Salesperson</th>}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
              {view.map((c) => {
                const wa = waReorderLink(c);
                const meta = STATUS_META[c.status];
                return (
                  <tr key={c.key} className={`transition-colors hover:bg-zinc-900/60 ${c.status === "overdue" ? "bg-red-950/10" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-200">
                      {c.name}
                      {c.phone && <div className="text-xs text-zinc-600">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">~{c.typicalIntervalDays}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className={c.status === "overdue" ? "text-red-400" : "text-zinc-300"}>{c.daysSinceLast}d ago</div>
                      <div className="text-xs text-zinc-600">{format(parseISO(c.lastOrder), "dd MMM yyyy")}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">
                      {fmtMoney(c.totalValue, currency)}
                      <div className="text-xs text-zinc-600">avg {fmtMoney(c.avgOrderValue, currency)}</div>
                    </td>
                    {isAdmin && <td className="px-4 py-3 text-zinc-400">{c.salesperson ?? "—"}</td>}
                    <td className="px-4 py-3 text-right">
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-[#b5c76a]/60 hover:text-[#b5c76a]"
                        >
                          Remind
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-700">No phone</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
