import { endOfMonth, format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, firstDayOfMonth, isAdminOrManager } from "@/lib/data";
import { getDeepCleaningRevenue } from "@/lib/deep-cleaning-revenue";
import { memberColor } from "@/lib/member-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { TargetForm } from "./target-form";
import { DeepCleaningTargetForm } from "./deep-cleaning-target";

function fmtMoney(v: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month ? `${sp.month}-01` : firstDayOfMonth();

  const members = await getTeamMembers();
  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const me = await getMyMembership();
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("v_target_vs_achieved")
    .select("member_id, month, target, achieved, pct")
    .eq("month", month);

  const rowMap = new Map((rows ?? []).map((r) => [r.member_id, r]));

  // Deep cleaning is tracked for the team, not per member, so it sits beside
  // the leaderboard rather than in it. Achieved is the combined figure --
  // Purex cash plus Xeltrix invoiced -- because a target set against one half
  // would look met whenever work moved to the other.
  const monthEnd = format(endOfMonth(parseISO(month)), "yyyy-MM-dd");
  const [{ data: dcTargetRow }, dcAchieved] = await Promise.all([
    supabase
      .from("deep_cleaning_targets")
      .select("amount")
      .eq("team_id", teamId)
      .eq("month", month)
      .maybeSingle(),
    getDeepCleaningRevenue(
      supabase,
      teamId,
      month,
      monthEnd,
      settings?.deep_cleaning_items ?? null
    ),
  ]);
  const dcTarget = dcTargetRow ? Number(dcTargetRow.amount) : null;
  const dcPct = dcTarget && dcTarget > 0 ? (dcAchieved.total / dcTarget) * 100 : null;
  const dcTone =
    dcPct === null ? "muted" : dcPct >= 100 ? "success" : dcPct >= 50 ? "warning" : "danger";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Targets</h1>
        <p className="text-sm text-zinc-500">
          {format(parseISO(month), "MMMM yyyy")} · Target vs Achieved (sales excl. tax)
        </p>
      </div>

      <TargetForm
        members={members.map((m) => ({
          id: m.id,
          name: ((m.profiles as unknown) as { full_name?: string } | null)?.full_name || "(unnamed)",
        }))}
        defaultMonth={month.slice(0, 7)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Deep cleaning · whole team</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <p className="text-xs text-zinc-500">Achieved</p>
              <p className="text-2xl font-bold tabular-nums">
                {fmtMoney(dcAchieved.total, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Target</p>
              <p className="text-2xl font-bold tabular-nums text-zinc-400">
                {dcTarget == null ? "—" : fmtMoney(dcTarget, currency)}
              </p>
            </div>
            {dcPct !== null && <Badge tone={dcTone}>{dcPct.toFixed(0)}%</Badge>}
          </div>

          {dcPct !== null && (
            <div className="h-2 w-full max-w-md rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-2 rounded-full ${
                  dcTone === "success" ? "bg-emerald-500" :
                  dcTone === "warning" ? "bg-amber-500" :
                  "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, dcPct))}%` }}
              />
            </div>
          )}

          <p className="text-xs text-zinc-500">
            Purex cash {fmtMoney(dcAchieved.purex, currency)} · Xeltrix invoiced{" "}
            {fmtMoney(dcAchieved.xeltrix, currency)}. Both companies count towards the same
            target, since it is one crew doing the work.
          </p>

          {isAdminOrManager(me?.role) && (
            <DeepCleaningTargetForm month={month.slice(0, 7)} current={dcTarget} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <EmptyState title="No team members" />
          ) : (
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Member</TH>
                  <TH right>Target</TH>
                  <TH right>Achieved</TH>
                  <TH right>%</TH>
                  <TH>Progress</TH>
                </TR>
              </THead>
              <TBody>
                {members
                  .map((mem) => {
                    const r = rowMap.get(mem.id);
                    const target = Number(r?.target ?? 0);
                    const achieved = Number(r?.achieved ?? 0);
                    const pct = Number(r?.pct ?? 0);
                    return {
                      id: mem.id,
                      name: ((mem.profiles as unknown) as { full_name?: string } | null)?.full_name || "(unnamed)",
                      target,
                      achieved,
                      pct,
                    };
                  })
                  .sort((a, b) => b.pct - a.pct)
                  .map((row) => {
                    const tone =
                      row.pct >= 100 ? "success" :
                      row.pct >= 50  ? "warning" :
                      row.target === 0 ? "muted" : "danger";
                    return (
                      <TR key={row.id}>
                        <TD className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${memberColor(row.id).dot}`} />
                            {row.name}
                          </span>
                        </TD>
                        <TD right>{fmtMoney(row.target, currency)}</TD>
                        <TD right>{fmtMoney(row.achieved, currency)}</TD>
                        <TD right>
                          <Badge tone={tone}>{row.pct.toFixed(0)}%</Badge>
                        </TD>
                        <TD>
                          <div className="h-2 w-40 rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              className={`h-2 rounded-full ${
                                tone === "success" ? "bg-emerald-500" :
                                tone === "warning" ? "bg-amber-500" :
                                tone === "danger"  ? "bg-red-500" :
                                "bg-zinc-300 dark:bg-zinc-700"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                            />
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
