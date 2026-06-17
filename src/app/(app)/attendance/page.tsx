import { addDays, format, getDay, getDate, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InstallHelp } from "@/components/install-help";
import { CheckInButton } from "./check-in-button";
import { MarkAttendanceForm } from "./mark-form";

const statusTone: Record<string, "success" | "danger" | "warning" | "info" | "muted"> = {
  present: "success",
  absent: "danger",
  half_day: "warning",
  leave: "info",
  wfh: "info",
  holiday_worked: "warning",
};

function isOffDay(date: Date, holidayMap: Map<string, boolean>) {
  const iso = format(date, "yyyy-MM-dd");
  if (holidayMap.get(iso) === false) return true; // listed closed holiday
  const dow = getDay(date); // 0=Sun..6=Sat
  if (dow === 0) return true;
  if (dow === 6 && getDate(date) <= 7) return true; // 1st Saturday
  return false;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const monthInput = sp.month ? parseISO(`${sp.month}-01`) : new Date();
  const monthStart = startOfMonth(monthInput);
  const monthEnd = endOfMonth(monthInput);
  const monthIso = format(monthStart, "yyyy-MM");

  const me = await getMyMembership();
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const allMembers = await getTeamMembers();
  // Salesperson buckets (e.g. "Maruthu & Nagaraj") have track_attendance=false
  // — keep them for sales, hide from the attendance grid + mark form.
  const members = allMembers.filter(
    (m) => (m as { track_attendance?: boolean }).track_attendance !== false
  );
  const canEdit = isAdminOrManager(me?.role);

  const supabase = await createClient();
  const [{ data: holidays }, { data: rows }, { data: balances }, { data: todayRow }] = await Promise.all([
    supabase
      .from("holidays")
      .select("date, name, working_allowed")
      .eq("team_id", teamId)
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd")),
    supabase
      .from("attendance")
      .select("member_id, date, status, hours")
      .eq("team_id", teamId)
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd")),
    supabase.from("v_leave_balance").select("member_id, balance"),
    me
      ? supabase
          .from("attendance")
          .select("id, status, check_in_at, check_out_at, hours")
          .eq("team_id", teamId)
          .eq("member_id", me.id)
          .eq("date", format(new Date(), "yyyy-MM-dd"))
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const holidayMap = new Map(
    (holidays ?? []).map((h) => [h.date as string, h.working_allowed as boolean])
  );
  const holidayNames = new Map(
    (holidays ?? []).map((h) => [h.date as string, h.name as string])
  );

  const cellMap = new Map<string, { status: string; hours: number | null }>();
  (rows ?? []).forEach((r) => {
    cellMap.set(`${r.member_id}__${r.date}`, { status: r.status, hours: r.hours });
  });

  const balanceMap = new Map<string, number>();
  (balances ?? []).forEach((b) =>
    balanceMap.set(b.member_id, Number(b.balance ?? 0))
  );

  const days: Date[] = [];
  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) days.push(d);

  const myBalance = me ? balanceMap.get(me.id) ?? 0 : 0;
  const prevMonth = format(addDays(monthStart, -1), "yyyy-MM");
  const nextMonth = format(addDays(monthEnd, 1), "yyyy-MM");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-zinc-500">Self check-in plus the team grid.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckInButton todayRow={todayRow ?? null} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your comp-off balance</CardTitle>
            <div className="text-3xl font-semibold">{myBalance.toFixed(1)} days</div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">Earned by working on Sundays, 1st Saturdays, or holidays. Never expires.</p>
          </CardContent>
        </Card>
      </div>

      {canEdit && <MarkAttendanceForm members={members.map((m) => ({
        id: m.id,
        name: ((m.profiles as unknown) as { full_name?: string } | null)?.full_name || "(unnamed)",
      }))} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{format(monthStart, "MMMM yyyy")}</span>
            <span className="flex gap-2 text-xs">
              <a className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700"
                 href={`/attendance?month=${prevMonth}`}>← Prev</a>
              <a className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700"
                 href={`/attendance?month=${monthIso}`}>This month</a>
              <a className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700"
                 href={`/attendance?month=${nextMonth}`}>Next →</a>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white pb-2 pr-2 text-left dark:bg-zinc-950">Member</th>
                  {days.map((d) => {
                    const off = isOffDay(d, holidayMap);
                    const hName = holidayNames.get(format(d, "yyyy-MM-dd"));
                    return (
                      <th
                        key={d.toISOString()}
                        title={hName}
                        className={`min-w-7 pb-2 text-center font-normal ${off ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}`}
                      >
                        {format(d, "d")}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {members.map((mem) => {
                  const prof = (mem.profiles as unknown) as { full_name?: string; avatar_url?: string } | null;
                  return (
                    <tr key={mem.id}>
                      <td className="sticky left-0 z-10 border-t border-zinc-200 bg-white py-1 pr-2 dark:border-zinc-800 dark:bg-zinc-950">
                        <span className="flex items-center gap-2">
                          <Avatar src={prof?.avatar_url} name={prof?.full_name} size={20} />
                          <span className="truncate">{prof?.full_name || "(unnamed)"}</span>
                        </span>
                      </td>
                      {days.map((d) => {
                        const iso = format(d, "yyyy-MM-dd");
                        const cell = cellMap.get(`${mem.id}__${iso}`);
                        const off = isOffDay(d, holidayMap);
                        let bg = off ? "bg-zinc-100 dark:bg-zinc-800" : "bg-white dark:bg-zinc-950";
                        if (cell) {
                          const tone = statusTone[cell.status];
                          if (tone === "success") bg = "bg-emerald-200 dark:bg-emerald-800";
                          else if (tone === "danger") bg = "bg-red-200 dark:bg-red-800";
                          else if (tone === "warning") bg = "bg-amber-200 dark:bg-amber-800";
                          else if (tone === "info") bg = "bg-blue-200 dark:bg-blue-800";
                        }
                        return (
                          <td
                            key={iso}
                            title={`${iso}${cell ? " · " + cell.status : ""}`}
                            className={`h-7 w-7 border border-zinc-200 text-center dark:border-zinc-800 ${bg}`}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-800" /> Present
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-red-200 dark:bg-red-800" /> Absent
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-amber-200 dark:bg-amber-800" /> Half / Holiday-worked
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-blue-200 dark:bg-blue-800" /> Leave / WFH
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-zinc-100 dark:bg-zinc-800" /> Off (Sun / 1st Sat / holiday)
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {Array.from(holidayNames.entries()).map(([d, name]) => (
              <Badge key={d} tone="muted">
                {format(parseISO(d), "dd MMM")} · {name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <InstallHelp />
    </div>
  );
}
