import { addDays, differenceInDays, endOfMonth, format, getDay, getDate, parseISO, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, firstDayOfMonth } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { TargetChart } from "@/components/target-chart";
import { CollectionsChart } from "@/components/collections-chart";
import { EmptyState } from "@/components/empty-state";
import { QuoteOfTheDay } from "@/components/quote-of-the-day";
import { EmployeeOfTheMonth } from "@/components/employee-of-the-month";
import { DashboardFilters } from "./filters";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

function isOffDay(date: Date, holidayClosed: Set<string>) {
  const iso = format(date, "yyyy-MM-dd");
  if (holidayClosed.has(iso)) return true;
  const dow = getDay(date);
  if (dow === 0) return true;
  if (dow === 6 && getDate(date) <= 7) return true;
  return false;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; member?: string; range?: string }>;
}) {
  const sp = await searchParams;
  // Legacy: month=yyyy-mm still supported. New: range=this_month|this_fy|...
  const range = sp.range
    ? resolveRange(sp.range)
    : resolveRange(sp.month ? `${sp.month}` : "this_month");
  const monthIso = sp.month ?? firstDayOfMonth().slice(0, 7);
  const monthDate = parseISO(`${monthIso}-01`);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthFirst = range.start ?? format(monthStart, "yyyy-MM-dd");
  const monthLast = range.end ?? format(monthEnd, "yyyy-MM-dd");

  const me = await getMyMembership();
  const members = await getTeamMembers();
  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const memberFilter = sp.member && sp.member !== "all" ? sp.member : null;
  const memberIdsScope = memberFilter
    ? [memberFilter]
    : members.map((m) => m.id);

  const supabase = await createClient();
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const [
    { data: tvaRows },
    { data: pipelineRows },
    { data: holidays },
    { data: attendanceRows },
    { data: balances },
    { data: openLeads },
    { data: openTasks },
    { data: openComplaints },
    { data: pendingCollRows },
    { data: deepJobs },
  ] = await Promise.all([
    supabase
      .from("v_target_vs_achieved")
      .select("member_id, target, achieved, pct")
      .eq("month", monthFirst)
      .in("member_id", memberIdsScope.length ? memberIdsScope : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("opportunities")
      .select("stage, value, value_excl_tax, owner_id, close_date")
      .in("owner_id", memberIdsScope.length ? memberIdsScope : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("holidays")
      .select("date, working_allowed")
      .eq("team_id", teamId)
      .gte("date", monthFirst)
      .lte("date", monthLast),
    supabase
      .from("attendance")
      .select("status, member_id, date, hours")
      .gte("date", monthFirst)
      .lte("date", monthLast)
      .in("member_id", memberIdsScope.length ? memberIdsScope : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("v_leave_balance").select("member_id, balance"),
    supabase
      .from("leads")
      .select("id")
      .eq("team_id", teamId)
      .in("status", ["new", "contacted", "qualified"]),
    supabase
      .from("tasks")
      .select("id")
      .eq("team_id", teamId)
      .in("status", ["todo", "in_progress"]),
    supabase
      .from("complaints")
      .select("id")
      .eq("team_id", teamId)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("opportunities")
      .select("balance_due, due_date, owner_id, zoho_salesperson_name")
      .eq("team_id", teamId)
      .eq("stage", "won")
      .gt("balance_due", 0)
      .in("owner_id", memberIdsScope.length ? memberIdsScope : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("deep_cleaning_jobs")
      .select("amount, cost, referral_amount, referral_status, service_date")
      .eq("team_id", teamId)
      .gte("service_date", monthFirst)
      .lte("service_date", monthLast),
  ]);

  // KPIs
  const target = (tvaRows ?? []).reduce((s, r) => s + Number(r.target ?? 0), 0);
  // Compute Sales Achieved DIRECTLY from won opps in the selected range
  const wonInRange = (pipelineRows ?? []).filter(
    (o) =>
      o.stage === "won" &&
      o.close_date &&
      o.close_date >= monthFirst &&
      o.close_date <= monthLast
  );
  const achieved = wonInRange.reduce((s, o) => s + Number(o.value ?? 0), 0);
  const achievedExcl = wonInRange.reduce(
    (s, o) => s + Number(o.value_excl_tax ?? o.value ?? 0),
    0
  );
  // Achievement % is measured on sales EXCLUDING tax (matches the team's
  // language and the v_target_vs_achieved view).
  const pct = target > 0 ? Math.round((achievedExcl / target) * 100) : null;

  // Attendance %: (worked_days) / (working_days)
  const holidayClosed = new Set(
    (holidays ?? []).filter((h) => !h.working_allowed).map((h) => h.date as string)
  );

  const dayList: Date[] = [];
  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) dayList.push(d);
  const workingDaysPerMember = dayList.filter((d) => !isOffDay(d, holidayClosed)).length;
  const totalWorkingDays = workingDaysPerMember * memberIdsScope.length;

  let workedDays = 0;
  (attendanceRows ?? []).forEach((a) => {
    if (a.status === "present" || a.status === "wfh") workedDays += 1;
    else if (a.status === "half_day") workedDays += 0.5;
    else if (a.status === "holiday_worked") workedDays += 1;
  });
  const attendancePct = totalWorkingDays > 0 ? Math.round((workedDays / totalWorkingDays) * 100) : null;

  // Comp-off balance (filtered)
  const memberScopeSet = new Set(memberIdsScope);
  const compOffSum = (balances ?? [])
    .filter((b) => memberScopeSet.has(b.member_id))
    .reduce((s, b) => s + Number(b.balance ?? 0), 0);

  // Pipeline value (not won/lost) — both incl. and excl. tax
  const pipelineRowsOpen = (pipelineRows ?? []).filter(
    (o) => o.stage !== "won" && o.stage !== "lost"
  );
  const pipelineValue = pipelineRowsOpen.reduce((s, o) => s + Number(o.value ?? 0), 0);
  const pipelineValueExcl = pipelineRowsOpen.reduce(
    (s, o) => s + Number(o.value_excl_tax ?? o.value ?? 0),
    0
  );

  // Pending collections
  const pendingCollTotal = (pendingCollRows ?? []).reduce(
    (s, r) => s + Number(r.balance_due ?? 0),
    0
  );
  const pendingCollCount = pendingCollRows?.length ?? 0;

  // Deep cleaning (non-GST) for the range
  const deepRevenue = (deepJobs ?? []).reduce((s, j) => s + Number(j.amount ?? 0), 0);
  const deepCount = deepJobs?.length ?? 0;
  const deepReferralPending = (deepJobs ?? [])
    .filter((j) => j.referral_status !== "paid")
    .reduce((s, j) => s + Number(j.referral_amount ?? 0), 0);

  // Collections chart: group by salesperson + aging bucket
  function agingKey(dueDateStr: string | null): "current" | "1-15" | "16-30" | "31-45" | "45+" {
    if (!dueDateStr) return "current";
    const days = differenceInDays(new Date(), parseISO(dueDateStr));
    if (days <= 0) return "current";
    if (days <= 15) return "1-15";
    if (days <= 30) return "16-30";
    if (days <= 45) return "31-45";
    return "45+";
  }
  type CollRow = { current: number; "1-15": number; "16-30": number; "31-45": number; "45+": number; total: number };
  const collByPerson = new Map<string, CollRow>();
  for (const r of pendingCollRows ?? []) {
    const label =
      r.zoho_salesperson_name ??
      (((members.find((m) => m.id === r.owner_id)?.profiles as unknown) as { full_name?: string } | null)?.full_name) ??
      "Unassigned";
    const bucket = agingKey(r.due_date ?? null);
    const amt = Number(r.balance_due ?? 0);
    const prev = collByPerson.get(label) ?? { current: 0, "1-15": 0, "16-30": 0, "31-45": 0, "45+": 0, total: 0 };
    prev[bucket] += amt;
    prev.total += amt;
    collByPerson.set(label, prev);
  }
  const collChartData = [...collByPerson.entries()]
    .map(([name, buckets]) => ({
      name: name.length > 12 ? name.slice(0, 11) + "…" : name,
      ...buckets,
    }))
    .sort((a, b) => b.total - a.total);

  // Chart data
  const chartData = members
    .filter((m) => !memberFilter || m.id === memberFilter)
    .map((m) => {
      const r = (tvaRows ?? []).find((row) => row.member_id === m.id);
      const profile = (m.profiles as unknown) as { full_name?: string } | null;
      return {
        name: profile?.full_name?.split(" ")[0] ?? "?",
        target: Number(r?.target ?? 0),
        achieved: Number(r?.achieved ?? 0),
      };
    })
    .filter((r) => r.target > 0 || r.achieved > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            {format(monthStart, "MMMM yyyy")}
            {memberFilter
              ? ` · ${members.find((m) => m.id === memberFilter && true) ? (((members.find((m) => m.id === memberFilter)?.profiles as unknown) as { full_name?: string } | null)?.full_name ?? "Selected member") : ""}`
              : " · whole team"}
          </p>
        </div>
        <DashboardFilters
          defaultMonth={monthIso}
          defaultMember={memberFilter ?? "all"}
          members={members.map((m) => ({
            id: m.id,
            name: ((m.profiles as unknown) as { full_name?: string } | null)?.full_name ?? "(unnamed)",
          }))}
        />
      </div>

      <RangeFilter
        basePath="/dashboard"
        current={range.key}
        extraParams={{ member: memberFilter ?? undefined }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Achievement %"
          value={pct === null ? "—" : `${pct}%`}
          hint={pct === null ? "Set targets to track" : "Sales (excl. tax) / Target"}
          tone={pct === null ? null : pct >= 100 ? "success" : pct >= 50 ? "warning" : "danger"}
          href="/targets"
        />
        <KpiCard
          label="Sales (excl. tax)"
          value={fmtMoney(achievedExcl, currency)}
          secondary={{ label: "Incl. tax", value: fmtMoney(achieved, currency) }}
          hint="Won opps"
          href="/opportunities"
          tone="success"
        />
        <KpiCard label="Target" value={fmtMoney(target, currency)} hint="Monthly goal" href="/targets" />
        <KpiCard
          label="Attendance %"
          value={attendancePct === null ? "—" : `${attendancePct}%`}
          hint={`${workedDays.toFixed(1)} / ${totalWorkingDays} working days`}
          href="/attendance"
        />
        <KpiCard
          label="Comp-off Balance"
          value={`${compOffSum.toFixed(1)} d`}
          hint="Total credit days"
          href="/attendance"
        />
        <KpiCard
          label="Pipeline"
          value={fmtMoney(pipelineValueExcl, currency)}
          secondary={{ label: "Incl. tax", value: fmtMoney(pipelineValue, currency) }}
          hint="Open stages"
          href="/opportunities"
        />
        <KpiCard
          label="Open Tasks"
          value={String(openTasks?.length ?? 0)}
          hint="todo + in_progress"
          href="/tasks"
        />
        <KpiCard
          label="Open Complaints"
          value={String(openComplaints?.length ?? 0)}
          hint="Unresolved"
          href="/complaints"
        />
        <KpiCard
          label="Pending Collections"
          value={fmtMoney(pendingCollTotal, currency)}
          hint={`${pendingCollCount} invoice${pendingCollCount !== 1 ? "s" : ""} outstanding`}
          href="/collections"
          tone={pendingCollTotal > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Deep Cleaning (non-GST)"
          value={fmtMoney(deepRevenue, currency)}
          secondary={deepReferralPending > 0 ? { label: "Referral pending", value: fmtMoney(deepReferralPending, currency) } : undefined}
          hint={`${deepCount} job${deepCount !== 1 ? "s" : ""} this period`}
          href="/deep-cleaning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuoteOfTheDay />
        <EmployeeOfTheMonth />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Target vs Achieved per Member</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyState
                title="No targets or sales yet"
                hint="Set targets in /targets and mark opportunities as won."
              />
            ) : (
              <TargetChart data={chartData} currency={currency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Members</CardTitle>
            <div className="text-3xl font-semibold">{members.length}</div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Open leads: {openLeads?.length ?? 0}</p>
            <p className="text-xs text-zinc-500">Signed in as {me?.role ?? "member"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pending Collections by Salesperson</CardTitle>
          <a href="/collections" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            View details →
          </a>
        </CardHeader>
        <CardContent>
          {collChartData.length === 0 ? (
            <EmptyState title="No outstanding collections" hint="All invoices are paid or balance data hasn't synced yet." />
          ) : (
            <CollectionsChart data={collChartData} currency={currency} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
