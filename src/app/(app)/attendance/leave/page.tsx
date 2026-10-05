import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, isAdminOrManager } from "@/lib/data";
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
  const [{ data: rows }, { data: balances }] = await Promise.all([
    supabase
      // attendance has no team_id — scope by current-org members instead
      .from("attendance")
      .select("member_id, status")
      .in("member_id", memberIds)
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`),
    supabase.from("v_leave_balance").select("member_id, balance"),
  ]);

  const byMember = new Map<string, Counts>();
  for (const r of rows ?? []) {
    const c = byMember.get(r.member_id as string) ?? { ...ZERO };
    const key = r.status as keyof Counts;
    if (key in c) c[key] += 1;
    byMember.set(r.member_id as string, c);
  }
  const compOff = new Map(
    (balances ?? []).map((b) => [b.member_id as string, Number(b.balance ?? 0)])
  );

  const table = members.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    const counts = byMember.get(m.id) ?? { ...ZERO };
    const taken = leaveTaken(counts);
    return {
      id: m.id as string,
      name: profile?.full_name || "(unnamed)",
      counts,
      worked: workedDays(counts),
      taken,
      remaining: entitlement == null ? null : entitlement - taken,
      compOff: compOff.get(m.id as string) ?? 0,
    };
  });

  const totals = table.reduce(
    (a, r) => ({
      worked: a.worked + r.worked,
      taken: a.taken + r.taken,
      absent: a.absent + r.counts.absent,
      compOff: a.compOff + r.compOff,
    }),
    { worked: 0, taken: 0, absent: 0, compOff: 0 }
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
                          {entitlement == null ? "—" : nice(entitlement)}
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
                        {nice(totals.compOff)}
                      </TD>
                    </TR>
                  </TBody>
                </Table>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                A half day counts as half a day worked and half a day of leave. Comp-off is
                earned by working holidays and is tracked separately — it does not come out
                of the allowance.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
