import Link from "next/link";
import { isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { ensureRoutineInstances } from "@/lib/routines";
import { memberColor } from "@/lib/member-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
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
            <Table>
              <THead>
                <TR hover={false}>
                  <TH>Employee</TH>
                  <TH right>Overdue</TH>
                  <TH right>Due today</TH>
                  <TH right>Upcoming</TH>
                  <TH right>Pending total</TH>
                  <TH right>Completed</TH>
                </TR>
              </THead>
              <TBody>
                {list.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">
                      <Link
                        href={`/tasks?member=${r.id}&status=pending`}
                        className="inline-flex items-center gap-2 hover:underline"
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${memberColor(r.id).dot}`} />
                        {r.name}
                      </Link>
                    </TD>
                    <TD right>
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
                    </TD>
                    <TD right>{r.today}</TD>
                    <TD right>{r.upcoming}</TD>
                    <TD right className="font-semibold">
                      {r.pending}
                    </TD>
                    <TD right className="text-emerald-600">
                      {r.completed || <span className="text-zinc-400">0</span>}
                    </TD>
                  </TR>
                ))}
                {unassigned.pending > 0 && (
                  <TR>
                    <TD className="italic text-zinc-500">Unassigned</TD>
                    <TD right>{unassigned.overdue}</TD>
                    <TD right>{unassigned.today}</TD>
                    <TD right>{unassigned.upcoming}</TD>
                    <TD right className="font-semibold">
                      {unassigned.pending}
                    </TD>
                    <TD right className="text-emerald-600">
                      {unassigned.completed}
                    </TD>
                  </TR>
                )}
                <TR hover={false} className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                  <TD>Team total</TD>
                  <TD right className="text-red-600">
                    {totals.overdue}
                  </TD>
                  <TD right>{totals.today}</TD>
                  <TD right>{totals.upcoming}</TD>
                  <TD right>{totals.pending}</TD>
                  <TD right className="text-emerald-600">
                    {totals.completed}
                  </TD>
                </TR>
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
