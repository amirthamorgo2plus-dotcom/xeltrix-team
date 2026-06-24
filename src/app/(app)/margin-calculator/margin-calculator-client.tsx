"use client";

import { useState, useCallback } from "react";

type Template = { id: string; name: string; sku: string | null; rate: number | null; cost_price: number | null; unit: string | null };
type Customer = { id: string; company_name: string };
type PriceList = { lead_id: string; item_id: string; custom_rate: number };
type ReferralCustomer = { lead_id: string; referrer_id: string; traded_pct: number | null; manufactured_pct: number | null; default_pct: number | null; first_invoice_pct: number | null };

type LineItem = { id: string; item_id: string; qty: number; override_rate: number | null };

const CATEGORIES = [
  { prefix: "R-", key: "traded" as const },
  { prefix: "RM-", key: "manufactured" as const },
  { prefix: "PM-", key: "manufactured" as const },
  { prefix: "X-", key: "manufactured" as const },
];
function itemCategory(name: string): "traded" | "manufactured" | "default" {
  for (const c of CATEGORIES) {
    if (name.toUpperCase().startsWith(c.prefix)) return c.key;
  }
  return "default";
}

function uid() {
  return Math.random().toString(36).slice(2);
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);

export function MarginCalculatorClient({
  templates,
  customers,
  priceLists,
  referralCustomers,
}: {
  templates: Template[];
  customers: Customer[];
  priceLists: PriceList[];
  referralCustomers: ReferralCustomer[];
}) {
  const [customerId, setCustomerId] = useState<string>("");
  const [lines, setLines] = useState<LineItem[]>([{ id: uid(), item_id: "", qty: 1, override_rate: null }]);

  const tMap = new Map(templates.map((t) => [t.id, t]));
  const plMap = new Map<string, number>();
  for (const pl of priceLists) {
    plMap.set(`${pl.lead_id}::${pl.item_id}`, pl.custom_rate);
  }
  const referral = referralCustomers.find((r) => r.lead_id === customerId) ?? null;

  function sellingRate(itemId: string): number | null {
    const key = `${customerId}::${itemId}`;
    if (plMap.has(key)) return plMap.get(key)!;
    const t = tMap.get(itemId);
    return t?.rate != null ? Number(t.rate) : null;
  }

  function commissionPct(itemId: string): number {
    if (!referral) return 0;
    const t = tMap.get(itemId);
    if (!t) return Number(referral.default_pct ?? 0);
    const cat = itemCategory(t.name);
    if (cat === "traded") return Number(referral.traded_pct ?? referral.default_pct ?? 0);
    if (cat === "manufactured") return Number(referral.manufactured_pct ?? referral.default_pct ?? 0);
    return Number(referral.default_pct ?? 0);
  }

  const addLine = useCallback(() => setLines((l) => [...l, { id: uid(), item_id: "", qty: 1, override_rate: null }]), []);
  const removeLine = useCallback((id: string) => setLines((l) => l.filter((x) => x.id !== id)), []);
  const updateLine = useCallback((id: string, patch: Partial<LineItem>) => {
    setLines((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  // Totals
  let totalRevenue = 0, totalCost = 0, totalCommission = 0;
  const computed = lines.map((line) => {
    const t = tMap.get(line.item_id);
    const stdSell = t ? sellingRate(line.item_id) : null;
    const sell = line.override_rate != null ? line.override_rate : (stdSell ?? 0);
    const cost = t?.cost_price != null ? Number(t.cost_price) : null;
    const commPct = t ? commissionPct(line.item_id) : 0;

    const revenue = sell * line.qty;
    const costTotal = cost != null ? cost * line.qty : null;
    const commission = revenue * (commPct / 100);

    const grossMargin = cost != null && sell > 0 ? ((sell - cost) / sell) * 100 : null;
    const netMargin = grossMargin != null ? grossMargin - commPct : null;

    totalRevenue += revenue;
    if (costTotal != null) totalCost += costTotal;
    totalCommission += commission;

    return { ...line, t, stdSell, sell, cost, commPct, revenue, costTotal, commission, grossMargin, netMargin };
  });

  const totalGrossMargin = totalRevenue > 0 && totalCost > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : null;
  const totalNetMargin = totalGrossMargin != null ? ((totalRevenue - totalCost - totalCommission) / totalRevenue) * 100 : null;

  function marginColor(pct: number | null) {
    if (pct == null) return "#71717a";
    if (pct >= 35) return "#b5c76a";
    if (pct >= 20) return "#eab308";
    return "#ef4444";
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Customer selector */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Customer (optional — loads custom prices + commission rates)</label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none w-72"
        >
          <option value="">— Standard rates, no referral —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
        {referral && (
          <p className="mt-1.5 text-xs text-amber-400">
            Referral active — commission rates: Traded {referral.traded_pct ?? "—"}%, Manufactured {referral.manufactured_pct ?? "—"}%, Default {referral.default_pct ?? "—"}%
          </p>
        )}
      </div>

      {/* Line items */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="pb-2 pr-3 w-64">Item</th>
              <th className="pb-2 pr-3 w-20 text-right">Qty</th>
              <th className="pb-2 pr-3 text-right">Sell Rate</th>
              <th className="pb-2 pr-3 text-right">Override Rate</th>
              <th className="pb-2 pr-3 text-right">Cost</th>
              <th className="pb-2 pr-3 text-right">Revenue</th>
              <th className="pb-2 pr-3 text-center">Gross %</th>
              <th className="pb-2 pr-3 text-right">Comm %</th>
              <th className="pb-2 text-center">Net %</th>
              <th className="pb-2 w-6" />
            </tr>
          </thead>
          <tbody>
            {computed.map((line) => (
              <tr key={line.id} className="border-t border-zinc-800">
                <td className="py-2 pr-3">
                  <select
                    value={line.item_id}
                    onChange={(e) => updateLine(line.id, { item_id: e.target.value, override_rate: null })}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none"
                  >
                    <option value="">— select item —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={line.qty}
                    onChange={(e) => updateLine(line.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none tabular-nums"
                  />
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-400 text-xs">
                  {line.stdSell != null ? fmt(line.stdSell) : "—"}
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="—"
                    value={line.override_rate ?? ""}
                    onChange={(e) => updateLine(line.id, { override_rate: e.target.value ? Number(e.target.value) : null })}
                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none tabular-nums"
                  />
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-500 text-xs">
                  {line.cost != null ? fmt(line.cost) : "—"}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-200">{fmt(line.revenue)}</td>
                <td className="py-2 pr-3 text-center">
                  {line.grossMargin != null ? (
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                      style={{ color: marginColor(line.grossMargin), background: `${marginColor(line.grossMargin)}18` }}>
                      {line.grossMargin.toFixed(1)}%
                    </span>
                  ) : <span className="text-zinc-600 text-xs">—</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-xs text-amber-400">
                  {line.commPct > 0 ? `${line.commPct}%` : "—"}
                </td>
                <td className="py-2 pr-3 text-center">
                  {line.netMargin != null ? (
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                      style={{ color: marginColor(line.netMargin), background: `${marginColor(line.netMargin)}18` }}>
                      {line.netMargin.toFixed(1)}%
                    </span>
                  ) : <span className="text-zinc-600 text-xs">—</span>}
                </td>
                <td className="py-2">
                  <button onClick={() => removeLine(line.id)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors" title="Remove">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addLine}
        className="self-start rounded-md border border-dashed border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:border-[#b5c76a]/50 hover:text-[#b5c76a] transition-colors"
      >
        + Add item
      </button>

      {/* Summary */}
      {computed.some((l) => l.item_id) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">Order Summary</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Total Revenue</p>
              <p className="text-xl font-bold tabular-nums text-zinc-100">{fmt(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Total Cost</p>
              <p className="text-xl font-bold tabular-nums text-zinc-300">{totalCost > 0 ? fmt(totalCost) : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Gross Margin</p>
              {totalGrossMargin != null ? (
                <p className="text-xl font-bold tabular-nums" style={{ color: marginColor(totalGrossMargin) }}>
                  {totalGrossMargin.toFixed(1)}%
                </p>
              ) : <p className="text-xl font-bold text-zinc-600">—</p>}
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Net Margin{referral ? " (after comm.)" : ""}</p>
              {totalNetMargin != null ? (
                <p className="text-xl font-bold tabular-nums" style={{ color: marginColor(totalNetMargin) }}>
                  {totalNetMargin.toFixed(1)}%
                </p>
              ) : <p className="text-xl font-bold text-zinc-600">—</p>}
            </div>
          </div>
          {referral && totalCommission > 0 && (
            <p className="mt-3 text-xs text-amber-400">
              Commission payable: {fmt(totalCommission)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
