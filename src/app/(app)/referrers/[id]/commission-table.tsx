"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { setCommissionStatus } from "../actions";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

export type CommissionRow = {
  oppId: string;
  /** Null until a commission has been logged for this invoice. */
  commissionId: string | null;
  customer: string;
  invoice: string;
  date: string | null;
  taxable: number;
  pct: number;
  amount: number;
  status: "paid" | "pending" | "not_logged";
  isFirst: boolean;
};

// One row, one checkbox, one clickable status. Previously the only way to
// settle anything was an all-or-nothing "Mark All Paid" button, so paying a
// referrer for some invoices but not others was impossible.
export function CommissionTable({ rows }: { rows: CommissionRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selectable = useMemo(() => rows.filter((r) => r.commissionId), [rows]);
  const allSelected = selectable.length > 0 && selected.size === selectable.length;

  const selectedRows = rows.filter((r) => r.commissionId && selected.has(r.commissionId));
  const selectedTotal = selectedRows.reduce((s, r) => s + r.amount, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply(ids: string[], status: "paid" | "pending") {
    if (ids.length === 0) return;
    setError(null);
    start(async () => {
      const res = await setCommissionStatus(ids, status);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#b5c76a]/25 bg-[#b5c76a]/5 px-3 py-2">
          <span className="text-sm text-[#b5c76a]">
            {selected.size} selected — {fmt(selectedTotal)}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => apply([...selected], "paid")}
              style={{ background: "#b5c76a", color: "#1a1a1a" }}
            >
              {pending ? "Saving…" : "Mark paid"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => apply([...selected], "pending")}
            >
              Mark pending
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="pb-2 pr-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all logged commissions"
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  onChange={() =>
                    setSelected(
                      allSelected
                        ? new Set()
                        : new Set(selectable.map((r) => r.commissionId as string))
                    )
                  }
                />
              </th>
              <th className="pb-2 pr-4">Customer</th>
              <th className="pb-2 pr-4">Invoice</th>
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4 text-right">Taxable Amt (excl. GST)</th>
              <th className="pb-2 pr-3 text-center">Rate</th>
              <th className="pb-2 pr-4 text-right">Est. Commission</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const checked = !!r.commissionId && selected.has(r.commissionId);
              return (
                <tr
                  key={r.oppId}
                  className="border-t border-zinc-800 transition-colors hover:bg-zinc-800/20"
                >
                  <td className="py-2.5 pr-3">
                    {r.commissionId ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.customer}`}
                        checked={checked}
                        onChange={() => toggle(r.commissionId as string)}
                      />
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-zinc-100">{r.customer}</td>
                  <td className="max-w-[200px] truncate py-2.5 pr-4 text-xs text-zinc-400">
                    {r.invoice}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-zinc-500">
                    {r.date ? format(parseISO(r.date), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-200">
                    {fmt(r.taxable)}
                  </td>
                  <td className="py-2.5 pr-3 text-center">
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {Math.round(r.pct * 10) / 10}%
                    </span>
                    {r.status === "not_logged" && r.isFirst && (
                      <span className="ml-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
                        1st
                      </span>
                    )}
                  </td>
                  <td
                    className="py-2.5 pr-4 text-right font-semibold tabular-nums"
                    style={{ color: "#b5c76a" }}
                  >
                    {fmt(r.amount)}
                  </td>
                  <td className="py-2.5">
                    {r.status === "not_logged" ? (
                      <span className="rounded-full bg-zinc-700/20 px-2 py-0.5 text-xs text-zinc-500">
                        Not logged
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        title={r.status === "paid" ? "Click to mark pending" : "Click to mark paid"}
                        onClick={() =>
                          apply(
                            [r.commissionId as string],
                            r.status === "paid" ? "pending" : "paid"
                          )
                        }
                        className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                          r.status === "paid"
                            ? "bg-[#b5c76a]/10 text-[#b5c76a] hover:bg-[#b5c76a]/20"
                            : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        }`}
                      >
                        {r.status === "paid" ? "✅ Paid" : "⬜ Pending"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-700">
              <td colSpan={4} className="pt-3 text-xs text-zinc-500">
                Total
              </td>
              <td className="pt-3 text-right font-bold tabular-nums text-zinc-200">
                {fmt(rows.reduce((s, r) => s + r.taxable, 0))}
              </td>
              <td />
              <td
                className="pt-3 text-right font-bold tabular-nums"
                style={{ color: "#b5c76a" }}
              >
                {fmt(rows.reduce((s, r) => s + r.amount, 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
