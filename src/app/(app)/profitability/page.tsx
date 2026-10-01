import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";
import {
  buildCostLookup,
  profitForLines,
  customerFromTitle,
  emptyProfit,
  type ProfitLineItem,
  type InvoiceProfit,
} from "@/lib/invoice-profit";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

const SORTS = {
  newest: "Newest",
  profit: "Highest profit",
  worst: "Lowest margin",
} as const;
type SortKey = keyof typeof SORTS;

// A customer has no single date, so "newest" is meaningless when grouped.
const CUSTOMER_SORTS: SortKey[] = ["profit", "worst"];

// PostgREST caps a response at 1000 rows, so paginate anything that can exceed it.
async function fetchAll<T>(
  // Supabase query builders are thenable rather than real Promises.
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await run(from, from + 999);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; sort?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const m = await getMyMembership();
  // Cost prices and margins are commercially sensitive — same gate as Payments.
  if (!m || !isAdminOrManager(m.role)) redirect("/dashboard");

  const teamId = m.team_id;
  const range = resolveRange(sp.range ?? "this_fy");
  const view: "invoice" | "customer" = sp.view === "customer" ? "customer" : "invoice";
  const requested: SortKey = sp.sort && sp.sort in SORTS ? (sp.sort as SortKey) : "newest";
  // Grouped by customer, fall back to profit rather than an undated sort.
  const sort: SortKey =
    view === "customer" && !CUSTOMER_SORTS.includes(requested) ? "profit" : requested;

  const supabase = await createClient();

  let invoiceQuery = supabase
    .from("zoho_invoices")
    .select("zoho_invoice_id, invoice_number, date, status, total")
    .eq("team_id", teamId);
  if (range.start) invoiceQuery = invoiceQuery.gte("date", range.start);
  if (range.end) invoiceQuery = invoiceQuery.lte("date", range.end);

  const [{ data: invoiceRows }, products, opps] = await Promise.all([
    invoiceQuery,
    fetchAll<{ zoho_item_id: string | null; sku: string | null; cost_price: number | null }>(
      (from, to) =>
        supabase
          .from("opportunity_templates")
          .select("zoho_item_id, sku, cost_price")
          .eq("team_id", teamId)
          .range(from, to)
    ),
    fetchAll<{ zoho_invoice_id: string; title: string | null }>((from, to) =>
      supabase
        .from("opportunities")
        .select("zoho_invoice_id, title")
        .eq("team_id", teamId)
        .not("zoho_invoice_id", "is", null)
        .range(from, to)
    ),
  ]);

  // Drafts and voids are not sales.
  const live = (invoiceRows ?? []).filter((i) => {
    const s = String(i.status ?? "").toLowerCase();
    return s !== "draft" && s !== "void";
  });
  const invoiceIds = live.map((i) => i.zoho_invoice_id as string);

  const items = invoiceIds.length
    ? await fetchAll<ProfitLineItem>((from, to) =>
        supabase
          .from("zoho_invoice_items")
          .select("zoho_invoice_id, zoho_item_id, sku, quantity, amount, unit_cost")
          .eq("team_id", teamId)
          .in("zoho_invoice_id", invoiceIds)
          .range(from, to)
      )
    : [];

  const lookup = buildCostLookup(products);
  const customerOf = new Map(
    opps.map((o) => [o.zoho_invoice_id, customerFromTitle(o.title)])
  );

  const linesByInvoice = new Map<string, ProfitLineItem[]>();
  for (const it of items) {
    const arr = linesByInvoice.get(it.zoho_invoice_id) ?? [];
    arr.push(it);
    linesByInvoice.set(it.zoho_invoice_id, arr);
  }

  type Row = InvoiceProfit & {
    id: string;
    number: string;
    date: string | null;
    customer: string | null;
  };

  const rows: Row[] = live.map((inv) => {
    const id = inv.zoho_invoice_id as string;
    const lines = linesByInvoice.get(id);
    const p = lines?.length ? profitForLines(lines, lookup) : emptyProfit();
    return {
      ...p,
      id,
      number: (inv.invoice_number as string) ?? "—",
      date: (inv.date as string) ?? null,
      customer: customerOf.get(id) ?? null,
    };
  });

  // Totals come from the rows on screen, so the strip always reconciles.
  const totals = rows.reduce(
    (a, r) => ({
      revenue: a.revenue + r.revenue,
      cost: a.cost + r.cost,
      uncosted: a.uncosted + r.uncosted,
    }),
    { revenue: 0, cost: 0, uncosted: 0 }
  );
  const grossProfit = totals.revenue - totals.cost;
  const marginPct = totals.revenue > 0 ? (grossProfit / totals.revenue) * 100 : null;
  const coveragePct =
    totals.revenue > 0 ? ((totals.revenue - totals.uncosted) / totals.revenue) * 100 : 0;
  const lossMakers = rows.filter((r) => r.revenue > 0 && r.profit < 0);
  const lossValue = lossMakers.reduce((s, r) => s + r.profit, 0);

  type CustomerRow = {
    customer: string;
    invoices: number;
    revenue: number;
    cost: number;
    uncosted: number;
    profit: number;
    marginPct: number | null;
  };

  const byCustomer = new Map<string, CustomerRow>();
  for (const r of rows) {
    const key = r.customer ?? "(unknown customer)";
    const e = byCustomer.get(key) ?? {
      customer: key,
      invoices: 0,
      revenue: 0,
      cost: 0,
      uncosted: 0,
      profit: 0,
      marginPct: null,
    };
    e.invoices += 1;
    e.revenue += r.revenue;
    e.cost += r.cost;
    e.uncosted += r.uncosted;
    byCustomer.set(key, e);
  }
  const customerRows = [...byCustomer.values()].map((c) => ({
    ...c,
    profit: c.revenue - c.cost,
    marginPct: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : null,
  }));

  const sortedCustomers = [...customerRows].sort((a, b) => {
    if (sort === "worst") {
      const am = a.marginPct ?? Number.POSITIVE_INFINITY;
      const bm = b.marginPct ?? Number.POSITIVE_INFINITY;
      return am - bm;
    }
    return b.profit - a.profit;
  });
  const losingCustomers = customerRows.filter((c) => c.revenue > 0 && c.profit < 0);

  const sorted = [...rows].sort((a, b) => {
    if (sort === "profit") return b.profit - a.profit;
    if (sort === "worst") {
      // Invoices with no revenue have no margin to rank.
      const am = a.marginPct ?? Number.POSITIVE_INFINITY;
      const bm = b.marginPct ?? Number.POSITIVE_INFINITY;
      return am - bm;
    }
    return String(b.date ?? "").localeCompare(String(a.date ?? ""));
  });

  function url(next: { range?: string; sort?: string; view?: string }) {
    const params = new URLSearchParams();
    const r = next.range ?? range.key;
    const v = next.view ?? view;
    // Switching to the grouped view drops a sort that view cannot honour.
    const s =
      next.sort ?? (v === "customer" && !CUSTOMER_SORTS.includes(sort) ? "profit" : sort);
    if (r && r !== "this_fy") params.set("range", r);
    if (v && v !== "invoice") params.set("view", v);
    if (s && s !== "newest") params.set("sort", s);
    const qs = params.toString();
    return `/profitability${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Profitability</h1>
        <p className="text-sm text-zinc-500">
          Gross profit per invoice — revenue less cost of goods. Excludes referral
          commission, manufacturing labour and overheads.
        </p>
      </div>

      <RangeFilter
        basePath="/profitability"
        current={range.key}
        extraParams={{ sort: sort !== "newest" ? sort : undefined }}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Revenue</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {fmt(totals.revenue)}
          </p>
          <p className="text-xs text-zinc-600">
            {rows.length} invoice{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Cost of goods</p>
          <p className="mt-1 text-xl font-bold text-zinc-300">{fmt(totals.cost)}</p>
          <p className="text-xs text-zinc-600">{Math.round(coveragePct)}% of revenue costed</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Gross profit</p>
          <p className="mt-1 text-xl font-bold text-[#b5c76a]">{fmt(grossProfit)}</p>
          <p className="text-xs text-zinc-600">
            {marginPct != null ? `${Math.round(marginPct * 10) / 10}% margin` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">
            {view === "customer" ? "Loss-making customers" : "Sold below cost"}
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              (view === "customer" ? losingCustomers.length : lossMakers.length) > 0
                ? "text-red-400"
                : "text-zinc-300"
            }`}
          >
            {view === "customer" ? losingCustomers.length : lossMakers.length}
          </p>
          <p className="text-xs text-zinc-600">
            {view === "customer"
              ? losingCustomers.length > 0
                ? `${fmt(losingCustomers.reduce((s2, c) => s2 + c.profit, 0))} lost`
                : "none"
              : lossMakers.length > 0
                ? `${fmt(lossValue)} lost`
                : "none"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {view === "customer"
                ? `${customerRows.length} customers in ${range.label}`
                : `Invoices in ${range.label}`}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
              {(["invoice", "customer"] as const).map((v) => (
                <Link
                  key={v}
                  href={url({ view: v })}
                  className={
                    view === v
                      ? "rounded bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "rounded px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  }
                >
                  {v === "invoice" ? "By invoice" : "By customer"}
                </Link>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
              {(view === "customer" ? CUSTOMER_SORTS : (Object.keys(SORTS) as SortKey[])).map((k) => (
                <Link
                  key={k}
                  href={url({ sort: k })}
                  className={
                    sort === k
                      ? "rounded bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "rounded px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  }
                >
                  {SORTS[k]}
                </Link>
              ))}
            </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <EmptyState
              title="No invoices in this range"
              hint="Invoices appear here as they sync from Zoho."
            />
          ) : view === "customer" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-3">Customer</th>
                    <th className="pb-2 pr-3 text-right">Invoices</th>
                    <th className="pb-2 pr-3 text-right">Revenue</th>
                    <th className="pb-2 pr-3 text-right">Cost</th>
                    <th className="pb-2 pr-3 text-right">Gross profit</th>
                    <th className="pb-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCustomers.map((c) => {
                    const loss = c.revenue > 0 && c.profit < 0;
                    return (
                      <tr
                        key={c.customer}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        <td className="max-w-[320px] truncate py-2 pr-3 font-medium">
                          {c.customer}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">
                          {c.invoices}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {fmt(c.revenue)}
                        </td>
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
                            <Badge
                              tone={loss ? "danger" : c.marginPct < 10 ? "warning" : "success"}
                            >
                              {Math.round(c.marginPct)}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
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
                  {sorted.map((r) => {
                    const loss = r.revenue > 0 && r.profit < 0;
                    return (
                      <tr
                        key={r.id}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        <td className="py-2 pr-3 font-medium">{r.number}</td>
                        <td className="py-2 pr-3 max-w-[260px] truncate text-zinc-300">
                          {r.customer ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-zinc-500">
                          {r.date ? format(parseISO(r.date), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {fmt(r.revenue)}
                        </td>
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
                          className={`py-2 pr-3 text-right tabular-nums font-medium ${
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
