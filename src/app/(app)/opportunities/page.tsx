import { createClient } from "@/lib/supabase/server";
import { getTeamSettings } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/export-button";
import { OpportunityForm } from "./opportunity-form";
import { StageSelect } from "./stage-select";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";

const STAGES = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

const stageTone: Record<(typeof STAGES)[number], "info" | "warning" | "success" | "danger" | "muted"> = {
  prospecting:   "muted",
  qualification: "info",
  proposal:      "info",
  negotiation:   "warning",
  won:           "success",
  lost:          "danger",
};

function fmtMoney(v: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

type Opp = {
  id: string;
  title: string;
  value: number | null;
  value_excl_tax: number | null;
  stage: string;
  close_date: string | null;
  lead: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp.range ?? "all");

  const supabase = await createClient();

  let q = supabase
    .from("opportunities")
    .select("id, title, value, value_excl_tax, stage, close_date, lead:leads(id, name)")
    .order("created_at", { ascending: false });

  if (range.start) q = q.gte("close_date", range.start);
  if (range.end) q = q.lte("close_date", range.end);

  const [{ data: opps }, { data: leads }, settings] = await Promise.all([
    q,
    supabase.from("leads").select("id, name").order("name"),
    getTeamSettings(),
  ]);

  const currency = settings?.currency || "INR";
  const grouped: Record<string, Opp[]> = {};
  STAGES.forEach((s) => (grouped[s] = []));
  ((opps as Opp[]) ?? []).forEach((o) => grouped[o.stage]?.push(o));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-zinc-500">
            {opps?.length ?? 0} opportunities in {range.label}
          </p>
        </div>
        <ExportButton href="/api/export/opportunities" />
      </div>

      <RangeFilter basePath="/opportunities" current={range.key} />

      <OpportunityForm leads={leads ?? []} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((stage) => {
          const list = grouped[stage] ?? [];
          const sumIncl = list.reduce((acc, o) => acc + Number(o.value || 0), 0);
          const sumExcl = list.reduce(
            (acc, o) => acc + Number(o.value_excl_tax ?? o.value ?? 0),
            0
          );
          return (
            <Card key={stage} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between capitalize">
                  <span>{stage}</span>
                  <Badge tone={stageTone[stage]}>{list.length}</Badge>
                </CardTitle>
                <div className="flex flex-col text-xs text-zinc-500">
                  <span>{fmtMoney(sumIncl, currency)} incl. tax</span>
                  <span>{fmtMoney(sumExcl, currency)} excl. tax</span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2">
                {list.length === 0 ? (
                  <p className="text-xs text-zinc-400">No deals.</p>
                ) : (
                  list.map((o) => {
                    const leadName = Array.isArray(o.lead)
                      ? o.lead[0]?.name
                      : (o.lead as { name?: string } | null)?.name;
                    const inclVal = Number(o.value || 0);
                    const exclVal = Number(o.value_excl_tax ?? o.value ?? 0);
                    return (
                      <div
                        key={o.id}
                        className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="text-sm font-medium">{o.title}</div>
                        <div className="text-xs text-zinc-500">{leadName ?? "—"}</div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="flex flex-col">
                            <span className="text-xs font-medium tabular-nums">
                              {fmtMoney(inclVal, currency)}
                            </span>
                            <span className="text-[10px] text-zinc-500 tabular-nums">
                              {fmtMoney(exclVal, currency)} excl
                            </span>
                          </span>
                          <StageSelect id={o.id} value={o.stage} />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
