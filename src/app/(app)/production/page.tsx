import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, isAdminOrManager } from "@/lib/data";
import { itemCategory } from "@/lib/item-category";
import {
  DEFAULT_PRODUCTION_ACCOUNTS,
  isSoapOrPhenyl,
  lineLitres,
  parseProductionLitres,
  RATE_OTHER,
  RATE_SOAP_PHENYL,
} from "@/lib/manufacturing-cost";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ProductionEntryForm, type ProductOption } from "./entry-form";
import { DeleteEntry } from "./delete-entry";

type Entry = {
  id: string;
  date: string;
  product_name: string;
  litres: number;
  rate: number;
  amount: number;
  notes: string | null;
  recorded_by: string | null;
};

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await getMyMembership();
  if ((me as { attendance_only?: boolean } | null)?.attendance_only) {
    redirect("/attendance");
  }
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const isAdmin = isAdminOrManager(me?.role);

  const sp = await searchParams;
  const cursor = sp.month ? parseISO(`${sp.month}-01`) : new Date();
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const from = format(monthStart, "yyyy-MM-dd");
  const to = format(monthEnd, "yyyy-MM-dd");
  const prevMonth = format(addDays(monthStart, -1), "yyyy-MM");
  const nextMonth = format(addDays(monthEnd, 1), "yyyy-MM");

  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";
  const teamMembers = await getTeamMembers();
  const memberName = new Map(
    teamMembers.map((m) => [
      m.id as string,
      (m.profiles as { full_name?: string } | null)?.full_name ?? "Member",
    ])
  );

  const supabase = await createClient();
  const [
    { data: entryRows },
    { data: templates },
    { data: monthInvoices },
    { data: lastEntryRow },
  ] = await Promise.all([
    supabase
      .from("production_entries")
      .select("id, date, product_name, litres, rate, amount, notes, recorded_by")
      .eq("team_id", teamId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
    supabase
      .from("opportunity_templates")
      .select("id, name, active")
      .eq("team_id", teamId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("zoho_invoices")
      .select("zoho_invoice_id")
      .eq("team_id", teamId)
      .gte("date", from)
      .lte("date", to),
    // The most recent entry overall, NOT within the month being viewed.
    // Opening an empty October should still say when production was last
    // recorded at all — otherwise the gap is exactly what stays hidden.
    supabase
      .from("production_entries")
      .select("date, product_name, litres, recorded_by")
      .eq("team_id", teamId)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const last = lastEntryRow?.[0]
    ? {
        date: lastEntryRow[0].date as string,
        productName: lastEntryRow[0].product_name as string,
        litres: Number(lastEntryRow[0].litres ?? 0),
        by: (lastEntryRow[0].recorded_by as string | null) ?? null,
        daysAgo: differenceInCalendarDays(
          new Date(),
          parseISO(lastEntryRow[0].date as string)
        ),
      }
    : null;

  // What was booked to a production account in this month, line by line.
  // These come from Zoho, where the litres are written into each line's
  // description next to the amount.
  const productionAccounts =
    settings?.production_expense_accounts?.length
      ? settings.production_expense_accounts
      : DEFAULT_PRODUCTION_ACCOUNTS;
  const { data: monthExpenses } = await supabase
    .from("zoho_expenses")
    .select("zoho_expense_id, date")
    .eq("team_id", teamId)
    .gte("date", from)
    .lte("date", to);
  const expenseDate = new Map(
    (monthExpenses ?? []).map((e) => [e.zoho_expense_id as string, e.date as string])
  );
  let zohoLines: {
    date: string;
    description: string | null;
    amount: number;
    parsed: { product: string; litres: number }[];
  }[] = [];
  const expenseIdList = [...expenseDate.keys()];
  if (expenseIdList.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < expenseIdList.length; i += CHUNK) {
      const { data: lines } = await supabase
        .from("zoho_expense_items")
        .select("zoho_expense_id, description, amount, account_name")
        .eq("team_id", teamId)
        .in("account_name", productionAccounts)
        .in("zoho_expense_id", expenseIdList.slice(i, i + CHUNK));
      for (const l of lines ?? []) {
        zohoLines.push({
          date: expenseDate.get(l.zoho_expense_id as string) ?? "",
          description: (l.description as string | null) ?? null,
          amount: Number(l.amount ?? 0),
          parsed: parseProductionLitres(l.description as string | null),
        });
      }
    }
    zohoLines = zohoLines.sort((a, b) => b.date.localeCompare(a.date));
  }
  const zohoLitres = zohoLines.reduce(
    (s, l) => s + l.parsed.reduce((t, p) => t + p.litres, 0),
    0
  );
  const zohoAmount = zohoLines.reduce((s, l) => s + l.amount, 0);
  const zohoUnread = zohoLines.filter((l) => l.parsed.length === 0).length;

  // Only the liquids we make can be produced, so the picker is X- items only.
  const products: ProductOption[] = (templates ?? [])
    .filter((t) => itemCategory(t.name as string) === "manufactured")
    .map((t) => ({ id: t.id as string, name: t.name as string }));

  const entries: Entry[] = (entryRows ?? []).map((r) => ({
    id: r.id as string,
    date: r.date as string,
    product_name: r.product_name as string,
    litres: Number(r.litres ?? 0),
    rate: Number(r.rate ?? 0),
    amount: Number(r.amount ?? 0),
    notes: (r.notes as string | null) ?? null,
    recorded_by: (r.recorded_by as string | null) ?? null,
  }));

  const producedSoap = entries.filter((e) => isSoapOrPhenyl(e.product_name))
    .reduce((s, e) => s + e.litres, 0);
  const producedOther = entries.filter((e) => !isSoapOrPhenyl(e.product_name))
    .reduce((s, e) => s + e.litres, 0);
  const producedLitres = producedSoap + producedOther;
  const producedCost = entries.reduce((s, e) => s + e.amount, 0);

  // Sold in the same month, for the stock movement. Invoice lines answer
  // "what left"; the entries above answer "what was made".
  const invoiceIds = (monthInvoices ?? []).map((i) => i.zoho_invoice_id as string);
  let soldLitres = 0;
  if (invoiceIds.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < invoiceIds.length; i += CHUNK) {
      const { data: lines } = await supabase
        .from("zoho_invoice_items")
        .select("name, quantity, unit")
        .eq("team_id", teamId)
        .in("zoho_invoice_id", invoiceIds.slice(i, i + CHUNK));
      for (const li of lines ?? []) {
        if (itemCategory(li.name as string) !== "manufactured") continue;
        soldLitres += lineLitres(li.name as string, li.quantity as number, li.unit as string);
      }
    }
  }
  const movement = producedLitres - soldLitres;

  const money = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const litres = (v: number) =>
    `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v)} L`;

  const byProduct = new Map<string, { litres: number; amount: number }>();
  for (const e of entries) {
    const b = byProduct.get(e.product_name) ?? { litres: 0, amount: 0 };
    b.litres += e.litres;
    b.amount += e.amount;
    byProduct.set(e.product_name, b);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Production</h1>
        <p className="text-sm text-zinc-500">
          Litres actually manufactured, by product. Invoices only show what was sold — this
          is what was made, and the difference is stock.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
            <span>Record production</span>
            {last ? (
              <span className="text-xs font-normal">
                <span className="text-zinc-500">Last recorded </span>
                <span className="text-zinc-300">
                  {format(parseISO(last.date), "dd MMM yyyy")}
                </span>
                <span className={last.daysAgo > 7 ? "text-amber-500" : "text-zinc-500"}>
                  {" · "}
                  {last.daysAgo === 0 ? "today" : `${last.daysAgo} days ago`}
                </span>
                <span className="text-zinc-500">
                  {" — "}
                  {new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
                    last.litres
                  )}
                  {" L "}
                  {last.productName}
                  {last.by && ` by ${memberName.get(last.by) ?? "a team member"}`}
                </span>
              </span>
            ) : (
              <span className="text-xs font-normal text-amber-500">
                Nothing recorded yet
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <EmptyState
              title="No manufactured products found"
              hint="Products beginning X- in the Zoho item list appear here."
            />
          ) : (
            <ProductionEntryForm products={products} currency={currency} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/production?month=${prevMonth}`}
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200"
            >
              <ChevronLeft className="h-4 w-4" />
              {format(addDays(monthStart, -1), "MMM")}
            </Link>
            <span>{format(monthStart, "MMMM yyyy")}</span>
            <Link
              href={`/production?month=${nextMonth}`}
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200"
            >
              {format(addDays(monthEnd, 1), "MMM")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Produced</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-100">
                {litres(producedLitres)}
              </p>
              <p className="text-[11px] text-zinc-500">
                {litres(producedSoap)} @ ₹{RATE_SOAP_PHENYL} · {litres(producedOther)} @ ₹
                {RATE_OTHER}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Labour cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#b5c76a]">
                {money(producedCost)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Sold (invoiced)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-100">
                {litres(soldLitres)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500">Stock movement</p>
              <p
                className={`mt-0.5 text-xl font-semibold tabular-nums ${
                  producedLitres === 0 ? "text-zinc-600" : movement >= 0 ? "text-[#b5c76a]" : "text-amber-500"
                }`}
              >
                {producedLitres === 0 ? "—" : `${movement >= 0 ? "+" : ""}${litres(movement)}`}
              </p>
              <p className="text-[11px] text-zinc-500">
                {producedLitres === 0
                  ? "record production to see this"
                  : movement >= 0
                    ? "built up"
                    : "drawn from stock"}
              </p>
            </div>
          </div>

          {zohoLines.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  Booked in Zoho this month
                </span>
                <span className="text-xs text-zinc-500">
                  {litres(zohoLitres)} read from {zohoLines.length} line
                  {zohoLines.length === 1 ? "" : "s"} · {money(zohoAmount)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left uppercase text-zinc-500">
                    <tr>
                      <th className="pb-1.5 pr-3">Date</th>
                      <th className="pb-1.5 pr-3">Description</th>
                      <th className="pb-1.5 pr-3 text-right">Litres read</th>
                      <th className="pb-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zohoLines.map((l, i) => {
                      const lineLitresTotal = l.parsed.reduce((t, p) => t + p.litres, 0);
                      return (
                        <tr
                          key={`${l.date}-${i}`}
                          className="border-t border-zinc-800/60"
                        >
                          <td className="whitespace-nowrap py-1.5 pr-3 text-zinc-500">
                            {l.date ? format(parseISO(l.date), "dd MMM") : "—"}
                          </td>
                          <td className="max-w-[360px] py-1.5 pr-3 text-zinc-300">
                            <span className="line-clamp-2">{l.description ?? "—"}</span>
                            {l.parsed.length > 1 && (
                              <span className="text-[10px] text-zinc-500">
                                {l.parsed.map((p) => `${p.product} ${p.litres} L`).join(" · ")}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {lineLitresTotal > 0 ? (
                              litres(lineLitresTotal)
                            ) : (
                              <span className="text-amber-500" title="No litres written in this description">
                                not stated
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-zinc-400">
                            {money(l.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                Read from each expense line&rsquo;s own text, since Zoho has no quantity
                field on an expense.{" "}
                {zohoUnread > 0 && (
                  <span className="text-amber-500">
                    {zohoUnread} line{zohoUnread === 1 ? "" : "s"} state no litres, so
                    they are not counted above.
                  </span>
                )}
              </p>
            </div>
          )}

          {entries.length === 0 ? (
            <EmptyState
              title="Nothing recorded this month"
              hint="Add what was made above — date, product and litres."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR hover={false}>
                      <TH>Date</TH>
                      <TH>Product</TH>
                      <TH right>Litres</TH>
                      <TH right>Rate</TH>
                      <TH right>Cost</TH>
                      <TH>Recorded by</TH>
                      <TH />
                    </TR>
                  </THead>
                  <TBody>
                    {entries.map((e) => (
                      <TR key={e.id}>
                        <TD className="whitespace-nowrap text-zinc-400">
                          {format(parseISO(e.date), "dd MMM")}
                        </TD>
                        <TD>
                          <span className="font-medium">{e.product_name}</span>
                          {e.notes && (
                            <span className="ml-2 text-xs text-zinc-500">{e.notes}</span>
                          )}
                        </TD>
                        <TD right>{litres(e.litres)}</TD>
                        <TD right className="text-zinc-400">
                          ₹{e.rate}
                        </TD>
                        <TD right className="font-medium">
                          {money(e.amount)}
                        </TD>
                        <TD className="text-xs text-zinc-500">
                          {e.recorded_by ? memberName.get(e.recorded_by) ?? "—" : "—"}
                        </TD>
                        <TD right>
                          <DeleteEntry id={e.id} canDelete={isAdmin} />
                        </TD>
                      </TR>
                    ))}
                    <TR hover={false} className="border-t-2 border-zinc-700 font-semibold">
                      <TD>Total</TD>
                      <TD className="text-zinc-500">
                        {byProduct.size} product{byProduct.size === 1 ? "" : "s"}
                      </TD>
                      <TD right>{litres(producedLitres)}</TD>
                      <TD />
                      <TD right>{money(producedCost)}</TD>
                      <TD />
                      <TD />
                    </TR>
                  </TBody>
                </Table>
              </div>
              <p className="text-xs text-zinc-500">
                Sold is taken from invoice lines for the same month, so stock movement is
                month-by-month and ignores anything made before this log started.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
