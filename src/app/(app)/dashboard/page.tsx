import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getTeamSummary() {
  const supabase = await createClient();

  const [{ data: members }, { data: leads }, { data: tasks }, { data: complaints }] =
    await Promise.all([
      supabase.from("team_members").select("id, role, active").eq("active", true),
      supabase.from("leads").select("id, status"),
      supabase.from("tasks").select("id, status, due_at"),
      supabase.from("complaints").select("id, status"),
    ]);

  return {
    memberCount: members?.length ?? 0,
    leadCount: leads?.length ?? 0,
    openTasks: tasks?.filter((t) => t.status !== "done" && t.status !== "cancelled").length ?? 0,
    openComplaints: complaints?.filter((c) => c.status === "open" || c.status === "in_progress").length ?? 0,
  };
}

export default async function DashboardPage() {
  const summary = await getTeamSummary();

  const cards = [
    { label: "Achievement %",   value: "—",                  hint: "Add targets to see this" },
    { label: "Sales Achieved",  value: "—",                  hint: "Sum of won opportunities" },
    { label: "Attendance %",    value: "—",                  hint: "Working days vs present" },
    { label: "Comp-off Balance", value: "—",                 hint: "Total credit days, team-wide" },
    { label: "Active Members",  value: String(summary.memberCount), hint: "On the Xeltrix team" },
    { label: "Open Leads",      value: String(summary.leadCount),   hint: "Across all stages" },
    { label: "Open Tasks",      value: String(summary.openTasks),   hint: "todo + in_progress" },
    { label: "Open Complaints", value: String(summary.openComplaints), hint: "Unresolved" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          Skeleton view. KPIs marked &quot;—&quot; will populate once you seed targets,
          attendance, and opportunities.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardTitle>{c.label}</CardTitle>
              <div className="text-3xl font-semibold">{c.value}</div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
            <li>
              Run all SQL files in <code>supabase/migrations/</code> via the Supabase SQL Editor (in order).
            </li>
            <li>
              In SQL Editor, run <code>select bootstrap_xeltrix();</code> while signed in to attach yourself as admin and seed 2026 holidays.
            </li>
            <li>
              Invite the other 6 members from Supabase Auth → Users → Invite, then run <code>select add_team_member(&apos;their@email&apos;);</code> for each.
            </li>
            <li>Build out: leads → tasks → attendance → targets → calendar.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
