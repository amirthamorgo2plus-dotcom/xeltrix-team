"use client";

import { useState, useCallback, useRef } from "react";
import { parsePdfInvoice } from "./actions";

type Template = { id: string; name: string; sku: string | null; rate: number | null; cost_price: number | null; unit: string | null };
type Customer = { id: string; company_name: string };
type PriceList = { lead_id: string; item_id: string; custom_rate: number };
type ReferralCustomer = { lead_id: string; referrer_id: string; referrer_name: string | null; traded_pct: number | null; manufactured_pct: number | null; default_pct: number | null; first_invoice_pct: number | null };

// custom_name: for free-text rows (PDF import); item_id: for catalog rows
type LineItem = { id: string; item_id: string; custom_name: string; qty: number; override_rate: number | null; cost_override: number | null };

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
  const [lines, setLines] = useState<LineItem[]>([{ id: uid(), item_id: "", custom_name: "", qty: 1, override_rate: null, cost_override: null }]);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tMap = new Map(templates.map((t) => [t.id, t]));
  const plMap = new Map<string, number>();
  for (const pl of priceLists) {
    plMap.set(`${pl.lead_id}::${pl.item_id}`, pl.custom_rate);
  }
  const referral = referralCustomers.find((r) => r.lead_id === customerId) ?? null;
  const customerName = customers.find((c) => c.id === customerId)?.company_name ?? "—";
  const referrerName = referral?.referrer_name ?? "—";

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

  // PDF upload handler — add all rows as-is (no matching)
  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfParsing(true);
    setPdfError(null);
    const fd = new FormData();
    fd.set("pdf", file);
    const result = await parsePdfInvoice(fd);
    setPdfParsing(false);
    if (result.error) { setPdfError(result.error); return; }

    const newLines: LineItem[] = result.rows.map((row) => ({
      id: uid(),
      item_id: "",
      custom_name: row.name,
      qty: row.qty,
      override_rate: null,
      cost_override: row.rate,
    }));

    if (newLines.length > 0) {
      setLines((prev) => {
        const hasEmpty = prev.length === 1 && prev[0].item_id === "" && prev[0].custom_name === "";
        return hasEmpty ? newLines : [...prev, ...newLines];
      });
    }
    // reset file input
    if (fileRef.current) fileRef.current.value = "";
  }

  const addLine = useCallback(() => setLines((l) => [...l, { id: uid(), item_id: "", custom_name: "", qty: 1, override_rate: null, cost_override: null }]), []);
  const removeLine = useCallback((id: string) => setLines((l) => l.filter((x) => x.id !== id)), []);
  const updateLine = useCallback((id: string, patch: Partial<LineItem>) => {
    setLines((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  // Totals
  let totalRevenue = 0, totalCost = 0, totalCommission = 0;
  const computed = lines.map((line) => {
    const t = line.item_id ? tMap.get(line.item_id) : undefined;
    const stdSell = t ? sellingRate(line.item_id) : null;
    const sell = line.override_rate != null ? line.override_rate : (stdSell ?? 0);
    const cost = line.cost_override != null ? line.cost_override : (t?.cost_price != null ? Number(t.cost_price) : null);
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

  function lineName(line: (typeof computed)[number]): string {
    if (line.custom_name) return line.custom_name;
    return line.t?.name ?? "";
  }

  // Rows that have a name + a usable selling price — what shows in the report
  const reportRows = computed.filter((l) => lineName(l) && l.sell > 0);
  const reportTotalCost = reportRows.reduce((s, l) => s + (l.costTotal ?? 0), 0);
  const reportTotalSales = reportRows.reduce((s, l) => s + l.revenue, 0);
  const reportTotalProfit = reportTotalSales - reportTotalCost;
  const reportTotalProfitPct = reportTotalSales > 0 ? (reportTotalProfit / reportTotalSales) * 100 : 0;

  const inr = (v: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v);

  // Build a clean printable report in a new window (Save as PDF or print)
  function printReport() {
    const rowsHtml = reportRows
      .map((l, i) => {
        const cost = l.cost ?? 0;
        const costVal = l.costTotal ?? 0;
        const profit = l.revenue - costVal;
        const profitPct = l.revenue > 0 ? (profit / l.revenue) * 100 : 0;
        const pColor = profitPct >= 35 ? "#1a7a2e" : profitPct >= 20 ? "#9a7d00" : "#c0392b";
        const pBg = profitPct >= 35 ? "#e7f4ea" : profitPct >= 20 ? "#fdf6e3" : "#fdecea";
        return `<tr>
          <td class="c">${i + 1}</td>
          <td>${lineName(l).replace(/</g, "&lt;")}</td>
          <td class="c">${l.qty}</td>
          <td class="r">${inr(cost)}</td>
          <td class="r">${inr(l.sell)}</td>
          <td class="r">${inr(costVal)}</td>
          <td class="r">${inr(l.revenue)}</td>
          <td class="r" style="color:${pColor}">${inr(profit)}</td>
          <td class="r" style="color:${pColor};background:${pBg};font-weight:600">${profitPct.toFixed(1)}%</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Margin Report — ${customerName}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #1a1a1a; }
      .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
      .head h1 { font-size:18px; margin:0 0 4px; }
      .meta { font-size:12px; color:#444; }
      .meta b { color:#1a1a1a; }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      th { background:#b5c76a; color:#1a1a1a; padding:7px 8px; text-align:left; border:1px solid #94a653; font-size:11px; text-transform:uppercase; }
      td { padding:6px 8px; border:1px solid #ddd; }
      tr:nth-child(even) td { background:#fafafa; }
      .c { text-align:center; }
      .r { text-align:right; font-variant-numeric:tabular-nums; }
      tfoot td { font-weight:700; background:#f0f3e6 !important; border-top:2px solid #94a653; }
      .ts { font-size:11px; color:#888; margin-top:10px; }
    </style></head><body>
      <div class="head">
        <div>
          <h1>Margin Calculation</h1>
          <div class="meta">Customer: <b>${customerName}</b>${referral ? ` &nbsp;•&nbsp; Referred by: <b>${referrerName}</b>` : ""}</div>
        </div>
        <div class="meta">Xeltrix Chemicals Private Limited</div>
      </div>
      <table>
        <thead><tr>
          <th>S.No</th><th>Product Name</th><th>Qty</th>
          <th>Purchase Price (Unit)</th><th>Selling Price (Unit)</th>
          <th>Cost Value</th><th>Sales Value</th><th>Profit ₹</th><th>Profit %</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="5" class="r">TOTAL</td>
          <td class="r">${inr(reportTotalCost)}</td>
          <td class="r">${inr(reportTotalSales)}</td>
          <td class="r">${inr(reportTotalProfit)}</td>
          <td class="r">${reportTotalProfitPct.toFixed(1)}%</td>
        </tr></tfoot>
      </table>
      <p class="ts">Generated from Xeltrix Team — Margin Calculator</p>
      <script>window.onload = () => { window.print(); }</script>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
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

      {/* PDF upload */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors ${pdfParsing ? "border-zinc-700 text-zinc-500" : "border-dashed border-zinc-600 text-zinc-400 hover:border-[#b5c76a]/50 hover:text-[#b5c76a]"}`}>
          {pdfParsing ? "⏳ Parsing…" : "📄 Upload Purchase PDF"}
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={pdfParsing} />
        </label>
        <span className="text-xs text-zinc-600">Upload a supplier invoice PDF — items + qty + cost price will be auto-filled</span>
      </div>
      {pdfError && <p className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">{pdfError}</p>}

      {/* Line items */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="pb-2 pr-3 w-64">Item</th>
              <th className="pb-2 pr-3 w-20 text-right">Qty</th>
              <th className="pb-2 pr-3 text-right">Sell Rate</th>
              <th className="pb-2 pr-3 text-right">Cost Price</th>
              <th className="pb-2 pr-3 text-right">Revenue</th>
              <th className="pb-2 pr-3 text-center">Gross %</th>
              <th className="pb-2 w-6" />
            </tr>
          </thead>
          <tbody>
            {computed.map((line) => (
              <tr key={line.id} className="border-t border-zinc-800">
                <td className="py-2 pr-3">
                  {line.custom_name !== "" ? (
                    <input
                      type="text"
                      value={line.custom_name}
                      onChange={(e) => updateLine(line.id, { custom_name: e.target.value })}
                      className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none"
                      placeholder="Item name"
                    />
                  ) : (
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
                  )}
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
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="—"
                    value={line.override_rate ?? (line.stdSell != null ? line.stdSell : "")}
                    onChange={(e) => updateLine(line.id, { override_rate: e.target.value ? Number(e.target.value) : null })}
                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none tabular-nums"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="—"
                    value={line.cost_override ?? (line.cost != null ? line.cost : "")}
                    onChange={(e) => updateLine(line.id, { cost_override: e.target.value ? Number(e.target.value) : null })}
                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-sm focus:border-[#b5c76a] focus:outline-none tabular-nums"
                    style={{ color: line.cost_override != null ? "#b5c76a" : "#71717a" }}
                  />
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
                <td className="py-2">
                  <button onClick={() => removeLine(line.id)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors" title="Remove">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          {reportRows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-zinc-700 font-semibold">
                <td className="py-3 pr-3 text-zinc-300">Total</td>
                <td className="py-3 pr-3 text-right tabular-nums text-zinc-300">
                  {reportRows.reduce((s, l) => s + l.qty, 0)}
                </td>
                <td />
                <td className="py-3 pr-3 text-right tabular-nums text-zinc-300">{fmt(totalCost)}</td>
                <td className="py-3 pr-3 text-right tabular-nums text-zinc-100">{fmt(totalRevenue)}</td>
                <td className="py-3 pr-3 text-center">
                  {totalGrossMargin != null ? (
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
                      style={{ color: marginColor(totalGrossMargin), background: `${marginColor(totalGrossMargin)}18` }}>
                      {totalGrossMargin.toFixed(1)}%
                    </span>
                  ) : <span className="text-zinc-600 text-xs">—</span>}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
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

      {/* Report preview (spreadsheet format) + print/download */}
      {reportRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Report Preview</h3>
            <button
              onClick={printReport}
              className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
              style={{ background: "#b5c76a", color: "#1a1a1a" }}
            >
              🖨️ Print / Download PDF
            </button>
          </div>

          {/* Light themed, screenshot-friendly */}
          <div className="overflow-x-auto rounded-lg border border-zinc-300 bg-white text-zinc-900">
            <div className="flex items-start justify-between gap-4 px-4 pt-4">
              <div>
                <p className="text-base font-bold">Margin Calculation</p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Customer: <span className="font-semibold text-zinc-900">{customerName}</span>
                  {referral && <> &nbsp;•&nbsp; Referred by: <span className="font-semibold text-zinc-900">{referrerName}</span></>}
                </p>
              </div>
              <p className="text-xs text-zinc-500">Xeltrix Chemicals Pvt Ltd</p>
            </div>
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr style={{ background: "#b5c76a" }} className="text-left uppercase text-[10px] text-zinc-900">
                  <th className="px-2 py-1.5 text-center">S.No</th>
                  <th className="px-2 py-1.5">Product Name</th>
                  <th className="px-2 py-1.5 text-center">Qty</th>
                  <th className="px-2 py-1.5 text-right">Purchase ₹/u</th>
                  <th className="px-2 py-1.5 text-right">Selling ₹/u</th>
                  <th className="px-2 py-1.5 text-right">Cost Value</th>
                  <th className="px-2 py-1.5 text-right">Sales Value</th>
                  <th className="px-2 py-1.5 text-right">Profit ₹</th>
                  <th className="px-2 py-1.5 text-right">Profit %</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((l, i) => {
                  const cost = l.cost ?? 0;
                  const costVal = l.costTotal ?? 0;
                  const profit = l.revenue - costVal;
                  const profitPct = l.revenue > 0 ? (profit / l.revenue) * 100 : 0;
                  const pColor = profitPct >= 35 ? "#1a7a2e" : profitPct >= 20 ? "#9a7d00" : "#c0392b";
                  const pBg = profitPct >= 35 ? "#e7f4ea" : profitPct >= 20 ? "#fdf6e3" : "#fdecea";
                  return (
                    <tr key={l.id} className="border-t border-zinc-200">
                      <td className="px-2 py-1.5 text-center text-zinc-500">{i + 1}</td>
                      <td className="px-2 py-1.5 font-medium">{lineName(l)}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{l.qty}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{inr(cost)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{inr(l.sell)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{inr(costVal)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{inr(l.revenue)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: pColor }}>{inr(profit)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: pColor, background: pBg }}>
                        {profitPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0f3e6" }} className="border-t-2 font-bold" >
                  <td colSpan={5} className="px-2 py-2 text-right">TOTAL</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(reportTotalCost)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(reportTotalSales)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{inr(reportTotalProfit)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{reportTotalProfitPct.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
