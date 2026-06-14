import { redirect } from "next/navigation";
import Link from "next/link";
import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { memberColor } from "@/lib/member-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";

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

// Effective days worked: full days + half credit, holiday work counts as worked.
function workedDays(c: Counts): number {
  return c.present + c.wfh + c.holiday_worked + c.half_day * 0.5;
}

export default async function AttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await getMyMembership();
  // Attendance-only staff just mark their own — keep them on the main page.
  if ((me as { attendance_only?: boolean } | null)?.attendance_only) {
    redirect("/attendance");
  }

  const sp = await searchParams;
  const monthInput = sp.month ? parseISO(`${sp.month}-01`) : new Date();
  const monthStart = startOfMonth(monthInput);
  const monthEnd = endOfMonth(monthInput);
  const monthIso = format(monthStart, "yyyy-MM");
  const prevMonth = format(addDays(monthStart, -1), "yyyy-MM");
  const nextMonth = format(addDays(monthEnd, 1), "yyyy-MM");

  const allMembers = await getTeamMembers();
  const members = allMembers.filter(
    (m) => (m as { track_attendance?: boolean }).track_attendance !== false
  );

  const supabase = await createClient();
  const [{ data: rows }, { data: balances }] = await Promise.all([
    supabase
      .from("attendance")
      .select("member_id, status")
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd")),
    supabase.from("v_leave_balance").select("member_id, balance"),
  ]);

  const counts = new Map<string, Counts>();
  members.forEach((m) => counts.set(m.id, { ...ZERO }));
  (rows ?? []).forEach((r) => {
    const c = counts.get(r.member_id as string);
    if (!c) return; // skip hidden/non-tracked members
    const s = r.status as keyof Counts;
    if (s in c) c[s] += 1;
  });

  const balanceMap = new Map<string, number>();
  (balances ?? []).forEach((b) => balanceMap.set(b.member_id, Number(b.balance ?? 0)));

  const list = members.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    const c = counts.get(m.id) ?? ZERO;
    return {
      id: m.id,
      name: profile?.full_name || "(unnamed)",
      c,
      worked: workedDays(c),
      compoff: balanceMap.get(m.id) ?? 0,
    };
  });
  list.sort((a, b) => b.worked - a.worked);

  const totals = list.reduce(
    (acc, r) => ({
      present: acc.present + r.c.present,
      wfh: acc.wfh + r.c.wfh,
      half_day: acc.half_day + r.c.half_day,
      holiday_worked: acc.holiday_worked + r.c.holiday_worked,
      leave: acc.leave + r.c.leave,
      absent: acc.absent + r.c.absent,
      worked: acc.worked + r.worked,
    }),
    { present: 0, wfh: 0, half_day: 0, holiday_worked: 0, leave: 0, absent: 0, worked: 0 }
  );

  const cols: { key: keyof Counts; label: string }[] = [
    { key: "present", label: "Present" },
    { key: "wfh", label: "WFH" },
    { key: "half_day", label: "Half day" },
    { key: "holiday_worked", label: "Holiday worked" },
    { key: "leave", label: "Leave" },
    { key: "absent", label: "Absent" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Attendance summary</h1>
          <p className="text-sm text-zinc-500">
            Per-employee totals for {format(monthStart, "MMMM yyyy")}.
          </p>
        </div>
        <ExportButton href={`/api/export/attendance-summary?month=${monthIso}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <Link
              href={`/attendance/summary?month=${prevMonth}`}
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <ChevronLeft className="h-4 w-4" /> {format(addDays(monthStart, -1), "MMM")}
            </Link>
            <span>{format(monthStart, "MMMM yyyy")}</span>
            <Link
              href={`/attendance/summary?month=${nextMonth}`}
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {format(addDays(monthEnd, 1), "MMM")} <ChevronRight className="h-4 w-4" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <EmptyState title="No members" />
          ) : (
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Employee</TH>
                  {cols.map((c) => (
                    <TH key={c.key} right>
                      {c.label}
                    </TH>
                  ))}
                  <TH right>Worked</TH>
                  <TH right>Comp-off</TH>
                </TR>
              </THead>
              <TBody>
                {list.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${memberColor(r.id).dot}`} />
                        {r.name}
                      </span>
                    </TD>
                    {cols.map((c) => (
                      <TD
                        key={c.key}
                        right
                        className={`${
                          c.key === "absent" && r.c.absent > 0 ? "text-red-600" : ""
                        } ${r.c[c.key] === 0 ? "text-zinc-400" : ""}`}
                      >
                        {r.c[c.key]}
                      </TD>
                    ))}
                    <TD right className="font-semibold">
                      {r.worked}
                    </TD>
                    <TD right>{r.compoff.toFixed(1)}</TD>
                  </TR>
                ))}
                <TR hover={false} className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                  <TD>Team total</TD>
                  {cols.map((c) => (
                    <TD key={c.key} right>
                      {totals[c.key]}
                    </TD>
                  ))}
                  <TD right>{totals.worked}</TD>
                  <TD />
                </TR>
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
