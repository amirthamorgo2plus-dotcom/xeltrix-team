import { format, isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { TaskForm } from "./task-form";
import { TaskStatusButton } from "./status-button";
import { AssigneeSelect } from "./assignee-select";

const priorityTone: Record<string, "muted" | "info" | "warning" | "danger"> = {
  low: "muted",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  owner_id: string | null;
};

function bucket(t: Task) {
  if (t.status === "done" || t.status === "cancelled") return "done";
  if (!t.due_at) return "upcoming";
  const due = new Date(t.due_at);
  if (isPast(due) && !isToday(due)) return "overdue";
  if (isToday(due)) return "today";
  return "upcoming";
}

export default async function TasksPage() {
  const me = await getMyMembership();
  const teamMembers = await getTeamMembers();

  const memberOpts = teamMembers.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    return { id: m.id, name: profile?.full_name || "(unnamed)" };
  });
  const memberById = new Map(
    teamMembers.map((m) => {
      const profile = (m.profiles as unknown) as { full_name?: string; avatar_url?: string } | null;
      return [m.id, { name: profile?.full_name || "(unnamed)", avatar_url: profile?.avatar_url ?? null }];
    })
  );

  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, description, due_at, priority, status, owner_id")
    .order("due_at", { ascending: true, nullsFirst: false });

  const tasks: Task[] = data ?? [];
  const groups: Record<string, Task[]> = { overdue: [], today: [], upcoming: [], done: [] };
  tasks.forEach((t) => groups[bucket(t)].push(t));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-zinc-500">{tasks.length} total</p>
        </div>
        <ExportButton href="/api/export/tasks" />
      </div>

      <TaskForm members={memberOpts} myMemberId={me?.id ?? null} />

      {(["overdue", "today", "upcoming", "done"] as const).map((key) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="capitalize">
              {key} {groups[key].length > 0 && <span className="ml-1 text-zinc-400">· {groups[key].length}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groups[key].length === 0 ? (
              <EmptyState title={`No ${key} tasks`} />
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {groups[key].map((t) => {
                  const owner = t.owner_id ? memberById.get(t.owner_id) : null;
                  return (
                    <li key={t.id} className="flex items-start gap-3 py-3">
                      <TaskStatusButton id={t.id} status={t.status} />
                      <div className="flex-1">
                        <div className={t.status === "done" ? "line-through text-zinc-500" : ""}>
                          {t.title}
                        </div>
                        {t.description && (
                          <div className="text-xs text-zinc-500">{t.description}</div>
                        )}
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {t.due_at && (
                            <span className="text-xs text-zinc-500">
                              Due {format(new Date(t.due_at), "dd MMM, HH:mm")}
                            </span>
                          )}
                          <Badge tone={priorityTone[t.priority] ?? "muted"}>{t.priority}</Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                            <Avatar src={owner?.avatar_url} name={owner?.name} size={18} />
                            <AssigneeSelect id={t.id} value={t.owner_id} members={memberOpts} />
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
