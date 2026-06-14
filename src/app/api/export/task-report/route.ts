import { isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

// Per-employee pending-task summary (overdue counted separately), matching
// the /tasks/report leaderboard.
export async function GET() {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase.from("tasks").select("status, due_at, owner_id"),
    memberNameLookup(),
  ]);
  if (error) return new Response(error.message, { status: 500 });

  type Acc = { overdue: number; today: number; upcoming: number; pending: number };
  const byMember = new Map<string, Acc>();
  const fresh = (): Acc => ({ overdue: 0, today: 0, upcoming: 0, pending: 0 });

  (data ?? []).forEach((t) => {
    const s = t.status as string;
    if (s !== "todo" && s !== "in_progress") return;
    const key = (t.owner_id as string) ?? "__unassigned__";
    const acc = byMember.get(key) ?? fresh();
    acc.pending += 1;
    const due = t.due_at ? new Date(t.due_at as string) : null;
    if (!due) acc.upcoming += 1;
    else if (isPast(due) && !isToday(due)) acc.overdue += 1;
    else if (isToday(due)) acc.today += 1;
    else acc.upcoming += 1;
    byMember.set(key, acc);
  });

  const rows = Array.from(byMember.entries())
    .map(([id, a]) => ({
      employee: id === "__unassigned__" ? "(unassigned)" : members.get(id) ?? "(unknown)",
      overdue: a.overdue,
      today: a.today,
      upcoming: a.upcoming,
      pending: a.pending,
    }))
    .sort((x, y) => y.overdue - x.overdue || y.pending - x.pending);

  const csv = toCsv(rows, [
    { key: "employee", header: "Employee" },
    { key: "overdue", header: "Overdue" },
    { key: "today", header: "Due today" },
    { key: "upcoming", header: "Upcoming" },
    { key: "pending", header: "Pending total" },
  ]);

  return csvResponse(csv, `pending-tasks-by-employee-${todayStamp()}.csv`);
}
