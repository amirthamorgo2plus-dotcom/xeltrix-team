import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getClosedDates,
  getFirstAttendanceDates,
  getMyMembership,
  getTeamMembers,
  getTeamSettings,
  isAdminOrManager,
} from "@/lib/data";
import { trackedFrom, unmarkedDays } from "@/lib/attendance-days";
import { memberColor } from "@/lib/member-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { EntitlementForm } from "./entitlement-form";

type Counts = {
  present: number;
  wfh: number;
  half_day: number;
  holiday_worked: number;
  leave: number;
  absent: number;
};

const ZERO: Counts = {
  present: 0,
  wfh: 0,
  half_day: 0,
  holiday_worked: 0,
  leave: 0,
  absent: 0,
};

// Same definition the monthly summary uses: a half day counts as half.
function workedDays(c: Counts): number {
  return c.present + c.wfh + c.holiday_worked + c.half_day * 0.5;
}

// Leave taken, counting a half day off as half a day. `half_day` means half a
// day WORKED, so the other half is leave.
function leaveTaken(c: Counts): number {
  return c.leave + c.half_day * 0.5;
}

const nice = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Share of a year someone was employed for, 0-1.
 *
 * Someone who starts in September should not get a full year's leave. Measured
 * in days rather than whole months so a mid-month start is not rounded in their
 * favour or against them. Returns 1 when no start date is recorded — a missing
 * date must never quietly reduce an allowance.
 */
function yearFraction(startIso: string | null, year: number): number {
  if (!startIso) return 1;
  const start = new Date(`${startIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return 1;
  const jan1 = Date.UTC(year, 0, 1);
  const dec31 = Date.UTC(year, 11, 31);
  if (start.getTime() <= jan1) return 1;
  if (start.getTime() > dec31) return 0;
  const DAY = 86_400_000;
  const daysInYear = (dec31 - jan1) / DAY + 1;
  const daysEmployed = (dec31 - start.getTime()) / DAY + 1;
  return Math.max(0, Math.min(1, daysEmployed / daysInYear));
}

export default async function LeaveBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const me = await getMyMembership();
  if ((me as { attendance_only?: boolean } | null)?.attendance_only) {
    redirect("/attendance");
  }
  const canManage = isAdminOrManager(me?.role);

  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const parsed = sp.year ? Number(sp.year) : thisYear;
  const year = Number.isFinite(parsed) && parsed > 2000 && parsed < 2100 ? parsed : thisYear;

  const settings = await getTeamSettings();
  const entitlement = settings?.annual_leave_days ?? null;

  const allMembers = await getTeamMembers();
  const members = allMembers.filter(
    (m) => (m as { track_attendance?: boolean }).track_attendance !== false
  );
  const memberIds = members.length
    ? members.map((m) => m.id)
    : ["00000000-0000-0000-0000-000000000000"];

  const supabase = await createClient();
  const [closedDates, firstAttendance] = await Promise.all([
    getClosedDates(),
    getFirstAttendanceDates(),
  ]);
  const [{ data: rows }, { data: balances }] = await Promise.all([
    supabase
      // attendance has no team_id — scope by current-org members instead
      .from("attendance")
      .select("member_id, date, status")
      .in("member_id", memberIds)
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`),
    supabase.from("v_leave_balance").select("member_id, balance"),
  ]);

  const byMember = new Map<string, Counts>();
  const marked = new Map<string, Set<string>>();
  for (const r of rows ?? []) {
    const id = r.member_id as string;
    const c = byMember.get(id) ?? { ...ZERO };
    const key = r.status as keyof Counts;
    if (key in c) c[key] += 1;
    byMember.set(id, c);
    const seen = marked.get(id) ?? new Set<string>();
    seen.add(r.date as string);
    marked.set(id, seen);
  }
  const compOff = new Map(
    (balances ?? []).map((b) => [b.member_id as string, Number(b.balance ?? 0)])
  );

  const table = members.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    const counts = byMember.get(m.id) ?? { ...ZERO };
    const taken = leaveTaken(counts);
    const start = (m as { employment_start?: string | null }).employment_start ?? null;
    // Anyone who started before January gets a full year automatically.
    const fraction = yearFraction(start, year);
    // Rounded to a half day — the smallest unit attendance is recorded in.
    const entitled =
      entitlement == null ? null : Math.round(entitlement * fraction * 2) / 2;
    // Working days in this year with no record, inside the tracked period only.
    const unmarked = unmarkedDays({
      windowStart: `${year}-01-01`,
      windowEnd: `${year}-12-31`,
      trackedFrom: trackedFrom(start, firstAttendance.get(m.id as string)),
      markedDates: marked.get(m.id as string) ?? new Set<string>(),
      closedDates,
    }).length;
    return {
      id: m.id as string,
      name: profile?.full_name || "(unnamed)",
      counts,
      unmarked,
      worked: workedDays(counts),
      taken,
      start,
      partYear: fraction < 1,
      entitled,
      remaining: entitled == null ? null : entitled - taken,
      compOff: compOff.get(m.id as string) ?? 0,
    };
  });

  const totals = table.reduce(
    (a, r) => ({
      worked: a.worked + r.worked,
      taken: a.taken + r.taken,
      absent: a.absent + r.counts.absent,
      unmarked: a.unmarked + r.unmarked,
      compOff: a.compOff + r.compOff,
    }),
    { worked: 0, taken: 0, absent: 0, unmarked: 0, compOff: 0 }
  );

  const overdrawn = table.filter((r) => r.remaining != null && r.remaining < 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Leave &amp; attendance by year</h1>
        <p className="text-sm text-zinc-500">
          Per-employee totals for {year} — entitlement, leave taken, what is left, and days
          worked.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Annual leave allowance</CardTitle>
        </CardHeader>
        <CardContent>
          <EntitlementForm current={entitlement} canManage={canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/attendance/leave?year=${year - 1}`}
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200"
            >
              <ChevronLeft className="h-4 w-4" />
              {year - 1}
            </Link>
            <CardTitle>{year}</CardTitle>
            <Link
              href={`/attendance/leave?year=${year + 1}`}
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200"
            >
              {year + 1}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {table.length === 0 ? (
            <EmptyState title="Nobody on the team has attendance tracking enabled" />
          ) : (
            <>
              {entitlement == null && (
                <p className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                  Set an annual leave allowance above to see how many days each person has
                  left. Leave taken and days worked are shown regardless.
                </p>
              )}
              {overdrawn.length > 0 && (
                <p className="mb-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                  {overdrawn.length} {overdrawn.length === 1 ? "person has" : "people have"}{" "}
                  taken more leave than the allowance:{" "}
                  {overdrawn.map((r) => r.name).join(", ")}
                </p>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Employee</TH>
                      <TH className="text-right">Entitled</TH>
                      <TH className="text-right">Leave taken</TH>
                      <TH className="text-right">Remaining</TH>
                      <TH className="text-right">Days worked</TH>
                      <TH className="text-right">Absent</TH>
                      <TH className="text-right">Unmarked</TH>
                      <TH className="text-right">Comp-off</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {table.map((r) => (
                      <TR key={r.id}>
                        <TD>
                          <span className="inline-flex items-center gap-2 font-medium">
                            <span
                              className={`inline-block h-2.5 w-2.5 rounded-full ${memberColor(r.id).dot}`}
                            />
                            {r.name}
                          </span>
                        </TD>
                        <TD className="text-right tabular-nums text-zinc-400">
                          {r.entitled == null ? (
                            "—"
                          ) : (
                            <>
                              {nice(r.entitled)}
                              {r.partYear && (
                                <span
                                  className="ml-1 text-[10px] text-amber-500"
                                  title={`Pro-rated from ${r.start} — part of ${year} only`}
                                >
                                  pro-rata
                                </span>
                              )}
                            </>
                          )}
                        </TD>
                        <TD className="text-right tabular-nums">{nice(r.taken)}</TD>
                        <TD
                          className={`text-right font-medium tabular-nums ${
                            r.remaining == null
                              ? "text-zinc-600"
                              : r.remaining < 0
                                ? "text-red-400"
                                : "text-[#b5c76a]"
                          }`}
                        >
                          {r.remaining == null ? "—" : nice(r.remaining)}
                        </TD>
                        <TD className="text-right font-medium tabular-nums">
                          {nice(r.worked)}
                        </TD>
                        <TD className="text-right tabular-nums text-zinc-400">
                          {r.counts.absent}
                        </TD>
                        <TD
                          className={`text-right tabular-nums ${
                            r.unmarked > 0 ? "text-amber-600 dark:text-amber-500" : "text-zinc-400"
                          }`}
                          title="Working days with no attendance record — not counted as absent"
                        >
                          {r.unmarked}
                        </TD>
                        <TD className="text-right tabular-nums text-zinc-400">
                          {nice(r.compOff)}
                        </TD>
                      </TR>
                    ))}
                    <TR>
                      <TD className="font-medium">Team total</TD>
                      <TD className="text-right text-zinc-600">—</TD>
                      <TD className="text-right font-medium tabular-nums">
                        {nice(totals.taken)}
                      </TD>
                      <TD className="text-right text-zinc-600">—</TD>
                      <TD className="text-right font-medium tabular-nums">
                        {nice(totals.worked)}
                      </TD>
                      <TD className="text-right font-medium tabular-nums">
                        {totals.absent}
                      </TD>
                      <TD className="text-right font-medium tabular-nums">
                        {totals.unmarked}
                      </TD>
                      <TD className="text-right font-medium tabular-nums">
                        {nice(totals.compOff)}
                      </TD>
                    </TR>
                  </TBody>
                </Table>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                <span className="text-amber-600 dark:text-amber-500">Unmarked</span> is a
                working day with no attendance record, counted only from the date each person
                started being tracked; it is not treated as absence and does not touch the
                allowance. A half day counts as half a day worked and half a day of leave. Comp-off is
                earned by working holidays and is tracked separately — it does not come out
                of the allowance. Anyone who started part-way through {year} is pro-rated
                from their employment start date, set on the Team page; everyone who
                started earlier gets the full allowance.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
