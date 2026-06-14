import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { MappingForm } from "./mapping-form";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";

function fmtMoney(v: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

export default async function SalespersonsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp.range ?? "all");

  const m = await getMyMembership();
  const canManage = isAdminOrManager(m?.role);
  const members = await getTeamMembers();
  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const supabase = await createClient();

  let oppQuery = supabase
    .from("opportunities")
    .select("zoho_salesperson_name, value, value_excl_tax, stage, close_date")
    .not("zoho_salesperson_name", "is", null);
  if (range.start) oppQuery = oppQuery.gte("close_date", range.start);
  if (range.end) oppQuery = oppQuery.lte("close_date", range.end);

  let quoteQuery = supabase
    .from("quotes")
    .select("zoho_salesperson_name, value, value_excl_tax, date")
    .not("zoho_salesperson_name", "is", null);
  if (range.start) quoteQuery = quoteQuery.gte("date", range.start);
  if (range.end) quoteQuery = quoteQuery.lte("date", range.end);

  const [{ data: oppAgg }, { data: quoteAgg }] = await Promise.all([oppQuery, quoteQuery]);

  type Stat = {
    name: string;
    invoiced: number;
    invoicedExcl: number;
    opp_count: number;
    quote_count: number;
  };
  const stats = new Map<string, Stat>();

  (oppAgg ?? []).forEach((o) => {
    const name = o.zoho_salesperson_name as string;
    const cur =
      stats.get(name) ?? { name, invoiced: 0, invoicedExcl: 0, opp_count: 0, quote_count: 0 };
    cur.opp_count++;
    if (o.stage === "won") {
      cur.invoiced += Number(o.value ?? 0);
      cur.invoicedExcl += Number(o.value_excl_tax ?? o.value ?? 0);
    }
    stats.set(name, cur);
  });
  (quoteAgg ?? []).forEach((q) => {
    const name = q.zoho_salesperson_name as string;
    const cur =
      stats.get(name) ?? { name, invoiced: 0, invoicedExcl: 0, opp_count: 0, quote_count: 0 };
    cur.quote_count++;
    stats.set(name, cur);
  });

  const memberOpts = members.map((mem) => {
    const profile = (mem.profiles as unknown) as { full_name?: string } | null;
    return {
      id: mem.id,
      name: profile?.full_name || "(unnamed)",
      zoho_salesperson_name:
        (mem as { zoho_salesperson_name?: string }).zoho_salesperson_name ?? null,
    };
  });
  const nameToMember = new Map(
    memberOpts
      .filter((mo) => mo.zoho_salesperson_name)
      .map((mo) => [mo.zoho_salesperson_name as string, mo])
  );

  const rows = Array.from(stats.values()).sort((a, b) => b.invoiced - a.invoiced);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Salespersons</h1>
        <p className="text-sm text-zinc-500">
          {rows.length} from Zoho · {range.label}
        </p>
      </div>

      <RangeFilter basePath="/salespersons" current={range.key} />

      <Card>
        <CardHeader>
          <CardTitle>Mapping ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {!canManage && (
            <p className="text-xs text-zinc-500">
              Read-only — only admins/managers can change mappings.
            </p>
          )}
          {rows.length === 0 ? (
            <EmptyState
              title="No salespersons seen yet"
              hint="Click Sync now on /integrations after assigning salespersons to invoices/estimates in Zoho."
            />
          ) : (
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Zoho salesperson</TH>
                  <TH right>Invoiced (incl. tax)</TH>
                  <TH right>Invoiced (excl. tax)</TH>
                  <TH right>Opps</TH>
                  <TH right>Quotes</TH>
                  <TH>Mapped to</TH>
                  {canManage && <TH>Change</TH>}
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const mapped = nameToMember.get(r.name) ?? null;
                  return (
                    <TR key={r.name}>
                      <TD className="font-medium">{r.name}</TD>
                      <TD right>{fmtMoney(r.invoiced, currency)}</TD>
                      <TD right className="text-zinc-500">
                        {fmtMoney(r.invoicedExcl, currency)}
                      </TD>
                      <TD right>{r.opp_count}</TD>
                      <TD right>{r.quote_count}</TD>
                      <TD>
                        {mapped ? (
                          <Badge tone="success">{mapped.name}</Badge>
                        ) : (
                          <Badge tone="muted">unmapped</Badge>
                        )}
                      </TD>
                      {canManage && (
                        <TD>
                          <MappingForm
                            salespersonName={r.name}
                            currentMemberId={mapped?.id ?? null}
                            members={memberOpts.map((mo) => ({ id: mo.id, name: mo.name }))}
                          />
                        </TD>
                      )}
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>Pick a team member from the dropdown to map them to that Zoho salesperson.</li>
            <li>
              When saved, all existing opps + quotes with that salesperson are reassigned (their{" "}
              <code>owner_id</code> moves to the mapped member).
            </li>
            <li>
              Set monthly targets at <a href="/targets" className="underline">/targets</a> for each
              member — the dashboard&apos;s <strong>Achievement %</strong> KPI will then compare each
              salesperson&apos;s sales against their target.
            </li>
            <li>Daily sync uses the mapping going forward.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
