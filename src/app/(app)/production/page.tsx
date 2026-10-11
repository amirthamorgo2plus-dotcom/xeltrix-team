import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, isAdminOrManager } from "@/lib/data";
import { itemCategory } from "@/lib/item-category";
import {
  isSoapOrPhenyl,
  lineLitres,
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
  const [{ data: entryRows }, { data: templates }, { data: monthInvoices }] = await Promise.all([
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
  ]);

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
          <CardTitle>Record production</CardTitle>
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
