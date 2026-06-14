import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

type Counts = {
  present: number;
  wfh: number;
  half_day: number;
  holiday_worked: number;
  leave: number;
  absent: number;
};
const ZERO: Counts = { present: 0, wfh: 0, half_day: 0, holiday_worked: 0, leave: 0, absent: 0 };

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const monthInput = monthParam ? parseISO(`${monthParam}-01`) : new Date();
  const monthStart = startOfMonth(monthInput);
  const monthEnd = endOfMonth(monthInput);

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("attendance")
      .select("member_id, status")
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd")),
    memberNameLookup(),
  ]);
  if (error) return new Response(error.message, { status: 500 });

  const counts = new Map<string, Counts>();
  (data ?? []).forEach((r) => {
    const key = r.member_id as string;
    const c = counts.get(key) ?? { ...ZERO };
    const s = r.status as keyof Counts;
    if (s in c) c[s] += 1;
    counts.set(key, c);
  });

  const rows = Array.from(counts.entries())
    .map(([id, c]) => ({
      employee: members.get(id) ?? "(unknown)",
      present: c.present,
      wfh: c.wfh,
      half_day: c.half_day,
      holiday_worked: c.holiday_worked,
      leave: c.leave,
      absent: c.absent,
      worked: c.present + c.wfh + c.holiday_worked + c.half_day * 0.5,
    }))
    .sort((a, b) => b.worked - a.worked);

  const csv = toCsv(rows, [
    { key: "employee", header: "Employee" },
    { key: "present", header: "Present" },
    { key: "wfh", header: "WFH" },
    { key: "half_day", header: "Half day" },
    { key: "holiday_worked", header: "Holiday worked" },
    { key: "leave", header: "Leave" },
    { key: "absent", header: "Absent" },
    { key: "worked", header: "Worked days" },
  ]);

  return csvResponse(csv, `attendance-summary-${format(monthStart, "yyyy-MM")}.csv`);
}
