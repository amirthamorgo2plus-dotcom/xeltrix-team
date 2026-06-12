import { endOfMonth, format, formatDistanceToNow, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getTeamSettings } from "@/lib/data";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fmtMoney(v: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

const OPEN_STAGES = ["prospecting", "qualification", "proposal", "negotiation"];

// Live Zoho snapshot, computed from data already synced into Supabase — no
// extra API calls, no setup. RLS scopes rows to the viewer's team.
export async function ZohoKpis() {
  const supabase = await createClient();
  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const now = new Date();
  const monthFirst = format(startOfMonth(now), "yyyy-MM-dd");
  const monthLast = format(endOfMonth(now), "yyyy-MM-dd");

  const [{ data: opps }, { data: integ }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("stage, value, value_excl_tax, close_date"),
    supabase
      .from("integrations")
      .select("last_synced_at, last_sync_error")
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = opps ?? [];
  const wonThisMonth = rows.filter(
    (o) =>
      o.stage === "won" &&
      o.close_date &&
      o.close_date >= monthFirst &&
      o.close_date <= monthLast
  );
  const salesExcl = wonThisMonth.reduce(
    (s, o) => s + Number(o.value_excl_tax ?? o.value ?? 0),
    0
  );
  const salesIncl = wonThisMonth.reduce((s, o) => s + Number(o.value ?? 0), 0);
  const pipeline = rows
    .filter((o) => OPEN_STAGES.includes(o.stage))
    .reduce((s, o) => s + Number(o.value ?? 0), 0);

  const lastSynced = integ?.last_synced_at
    ? `${formatDistanceToNow(new Date(integ.last_synced_at))} ago`
    : "never";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Zoho Books · {format(now, "MMMM yyyy")}</CardTitle>
        <span className="text-xs text-zinc-500">Last sync {lastSynced}</span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Sales this month (excl. tax)"
            value={fmtMoney(salesExcl, currency)}
            secondary={{ label: "incl. tax", value: fmtMoney(salesIncl, currency) }}
            href="/dashboard"
          />
          <KpiCard
            label="Invoices won this month"
            value={wonThisMonth.length}
            href="/opportunities"
          />
          <KpiCard
            label="Open pipeline"
            value={fmtMoney(pipeline, currency)}
            href="/opportunities"
          />
        </div>
      </CardContent>
    </Card>
  );
}
