import Link from "next/link";
import { isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { ensureRoutineInstances } from "@/lib/routines";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";

type Row = {
  id: string;
  name: string;
  overdue: number;
  today: number;
  upcoming: number;
  pending: number;
  completed: number;
};

function isPendingStatus(s: string) {
  return s === "todo" || s === "in_progress";
}

export default async function TaskReportPage() {
  const me = await getMyMembership();
  const teamMembers = await getTeamMembers();
  const supabase = await createClient();

  if (me?.team_id) {
    await ensureRoutineInstances(
      supabase,
      me.team_id,
      teamMembers.map((m) => m.id)
    );
  }

  const { data: tasksData } = await supabase
    .from("tasks")
    .select("status, due_at, owner_id");

  const rows = new Map<string, Row>();
  teamMembers.forEach((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    rows.set(m.id, {
      id: m.id,
      name: profile?.full_name || "(unnamed)",
      overdue: 0,
      today: 0,
      upcoming: 0,
      pending: 0,
      completed: 0,
    });
  });

  const unassigned = { overdue: 0, today: 0, upcoming: 0, pending: 0, completed: 0 };

  (tasksData ?? []).forEach((t) => {
    const status = t.status as string;
    const bucketObj = (t.owner_id ? rows.get(t.owner_id as string) : null) ?? unassigned;
    if (status === "done") {
      bucketObj.completed += 1;
      return;
    }
    if (!isPendingStatus(status)) return; // ignore cancelled
    bucketObj.pending += 1;
    if (!t.due_at) {
      bucketObj.upcoming += 1;
    } else {
      const due = new Date(t.due_at as string);
      if (isPast(due) && !isToday(due)) bucketObj.overdue += 1;
      else if (isToday(due)) bucketObj.today += 1;
      else bucketObj.upcoming += 1;
    }
  });

  const list = Array.from(rows.values()).sort(
    (a, b) => b.overdue - a.overdue || b.pending - a.pending
  );

  const totals = list.reduce(
    (acc, r) => ({
      overdue: acc.overdue + r.overdue,
      today: acc.today + r.today,
      upcoming: acc.upcoming + r.upcoming,
      pending: acc.pending + r.pending,
      completed: acc.completed + r.completed,
    }),
    { overdue: 0, today: 0, upcoming: 0, pending: 0, completed: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pending tasks by employee</h1>
          <p className="text-sm text-zinc-500">
            Open tasks (todo + in&nbsp;progress) per person — overdue counted separately;
            completed shown for context.
          </p>
        </div>
        <ExportButton href="/api/export/task-report" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <EmptyState title="No team members" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Employee</th>
                  <th className="pb-2 pr-4 text-right">Overdue</th>
                  <th className="pb-2 pr-4 text-right">Due today</th>
                  <th className="pb-2 pr-4 text-right">Upcoming</th>
                  <th className="pb-2 pr-4 text-right">Pending total</th>
                  <th className="pb-2 pr-4 text-right">Completed</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        href={`/tasks?member=${r.id}&status=pending`}
                        className="hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.overdue > 0 ? (
                        <Link
                          href={`/tasks?member=${r.id}&status=overdue`}
                          className="font-semibold text-red-600 hover:underline"
                        >
                          {r.overdue}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">0</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.today}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.upcoming}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums">{r.pending}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">
                      {r.completed || <span className="text-zinc-400">0</span>}
                    </td>
                  </tr>
                ))}
                {(unassigned.pending > 0) && (
                  <tr className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-2 pr-4 italic text-zinc-500">Unassigned</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{unassigned.overdue}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{unassigned.today}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{unassigned.upcoming}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums">{unassigned.pending}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">{unassigned.completed}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-zinc-300 dark:border-zinc-700">
                  <td className="py-2 pr-4 font-semibold">Team total</td>
                  <td className="py-2 pr-4 text-right font-semibold tabular-nums text-red-600">
                    {totals.overdue}
                  </td>
                  <td className="py-2 pr-4 text-right font-semibold tabular-nums">{totals.today}</td>
                  <td className="py-2 pr-4 text-right font-semibold tabular-nums">{totals.upcoming}</td>
                  <td className="py-2 pr-4 text-right font-semibold tabular-nums">{totals.pending}</td>
                  <td className="py-2 pr-4 text-right font-semibold tabular-nums text-emerald-600">
                    {totals.completed}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
