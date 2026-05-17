import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { MappingForm } from "./mapping-form";

function fmtMoney(v: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

export default async function SalespersonsPage() {
  const m = await getMyMembership();
  const canManage = isAdminOrManager(m?.role);
  const members = await getTeamMembers();
  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const supabase = await createClient();

  // Distinct Zoho salespersons seen on opps + quotes, with totals
  const { data: oppAgg } = await supabase
    .from("opportunities")
    .select("zoho_salesperson_name, value, stage")
    .not("zoho_salesperson_name", "is", null);
  const { data: quoteAgg } = await supabase
    .from("quotes")
    .select("zoho_salesperson_name, value")
    .not("zoho_salesperson_name", "is", null);

  type Stat = { name: string; invoiced: number; opp_count: number; quote_count: number };
  const stats = new Map<string, Stat>();

  (oppAgg ?? []).forEach((o) => {
    const name = o.zoho_salesperson_name as string;
    const cur = stats.get(name) ?? { name, invoiced: 0, opp_count: 0, quote_count: 0 };
    cur.opp_count++;
    if (o.stage === "won") cur.invoiced += Number(o.value ?? 0);
    stats.set(name, cur);
  });
  (quoteAgg ?? []).forEach((q) => {
    const name = q.zoho_salesperson_name as string;
    const cur = stats.get(name) ?? { name, invoiced: 0, opp_count: 0, quote_count: 0 };
    cur.quote_count++;
    stats.set(name, cur);
  });

  // Existing mapping: salesperson_name -> member
  const memberOpts = members.map((mem) => {
    const profile = (mem.profiles as unknown) as { full_name?: string } | null;
    return {
      id: mem.id,
      name: profile?.full_name || "(unnamed)",
      zoho_salesperson_name: (mem as { zoho_salesperson_name?: string }).zoho_salesperson_name ?? null,
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
          Map Zoho Books salespersons to Xeltrix Team members so per-member sales targets and
          dashboard KPIs reflect real attribution.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapping ({rows.length} from Zoho)</CardTitle>
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
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Zoho salesperson</th>
                  <th className="pb-2 pr-4 text-right">Invoiced (won)</th>
                  <th className="pb-2 pr-4 text-right">Opps</th>
                  <th className="pb-2 pr-4 text-right">Quotes</th>
                  <th className="pb-2 pr-4">Mapped to</th>
                  {canManage && <th className="pb-2">Change</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const mapped = nameToMember.get(r.name) ?? null;
                  return (
                    <tr key={r.name} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-2 pr-4 font-medium">{r.name}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {fmtMoney(r.invoiced, currency)}
                      </td>
                      <td className="py-2 pr-4 text-right">{r.opp_count}</td>
                      <td className="py-2 pr-4 text-right">{r.quote_count}</td>
                      <td className="py-2 pr-4">
                        {mapped ? (
                          <Badge tone="success">{mapped.name}</Badge>
                        ) : (
                          <Badge tone="muted">unmapped</Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className="py-2">
                          <MappingForm
                            salespersonName={r.name}
                            currentMemberId={mapped?.id ?? null}
                            members={memberOpts.map((mo) => ({ id: mo.id, name: mo.name }))}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
