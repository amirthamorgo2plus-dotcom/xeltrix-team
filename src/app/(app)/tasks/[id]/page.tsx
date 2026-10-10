import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isPast, isToday } from "date-fns";
import { ChevronLeft, Repeat } from "lucide-react";
import { ist, isoToIstInput } from "@/lib/ist";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { memberColor } from "@/lib/member-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TaskStatusSelect } from "../status-select";
import { AssigneeSelect } from "../assignee-select";
import { TaskComments, type TaskComment } from "../task-comments";
import { TaskEditForm } from "./task-edit-form";

const priorityTone: Record<string, "muted" | "info" | "warning" | "danger"> = {
  low: "muted",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const me = await getMyMembership();
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const canManage = isAdminOrManager(me?.role);
  const teamMembers = await getTeamMembers();

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, title, description, due_at, priority, status, owner_id, routine_id, created_at, updated_at"
    )
    .eq("team_id", teamId)
    .eq("id", id)
    .maybeSingle();

  // Also covers a task in another team: the team_id filter makes it invisible
  // rather than forbidden, which is the right answer either way.
  if (!task) notFound();

  const { data: commentsData } = await supabase
    .from("comments")
    .select("id, body, author_id, mentioned_ids, attachment_url, created_at")
    .eq("subject_type", "task")
    .eq("subject_id", id)
    .order("created_at", { ascending: true });

  const comments: TaskComment[] = (commentsData ?? []).map((c) => ({
    id: c.id as string,
    body: c.body as string,
    author_id: c.author_id as string,
    mentioned_ids: (c.mentioned_ids as string[]) ?? [],
    attachment_url: (c.attachment_url as string) ?? null,
    created_at: c.created_at as string,
  }));

  const members = teamMembers.map((m) => {
    const profile = (m.profiles as unknown) as {
      full_name?: string;
      avatar_url?: string;
    } | null;
    return {
      id: m.id as string,
      name: profile?.full_name || "(unnamed)",
      avatar_url: profile?.avatar_url ?? null,
    };
  });
  const memberOpts = members.map((m) => ({ id: m.id, name: m.name }));
  const owner = task.owner_id ? members.find((m) => m.id === task.owner_id) : null;
  const color = memberColor(task.owner_id as string | null);

  const due = task.due_at ? new Date(task.due_at as string) : null;
  const overdue =
    due !== null && isPast(due) && !isToday(due) && task.status !== "done" && task.status !== "cancelled";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ChevronLeft className="h-4 w-4" />
          All tasks
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-start gap-3">
            <span className="mt-0.5">
              <TaskStatusSelect id={task.id as string} status={task.status as string} />
            </span>
            <span className="flex-1">
              {task.routine_id && (
                <Repeat className="mr-1.5 inline h-4 w-4 align-[-3px] text-indigo-500" />
              )}
              {task.title as string}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className={`border-l-4 ${color.border}`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <Avatar
                  src={owner?.avatar_url}
                  name={owner?.name}
                  size={22}
                  className={`ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950 ${color.ring}`}
                />
                <AssigneeSelect
                  id={task.id as string}
                  value={task.owner_id as string | null}
                  members={memberOpts}
                />
              </span>

              <span className="inline-flex items-center gap-2">
                <span className="text-zinc-500">Priority</span>
                <Badge tone={priorityTone[task.priority as string] ?? "muted"}>
                  {task.priority as string}
                </Badge>
              </span>

              <span className="inline-flex items-center gap-2">
                <span className="text-zinc-500">Due</span>
                {due ? (
                  <span className={overdue ? "font-medium text-red-500" : ""}>
                    {format(ist(due), "dd MMM yyyy, HH:mm")}
                    {overdue && " · overdue"}
                  </span>
                ) : (
                  <span className="text-zinc-500">not set</span>
                )}
              </span>

              {task.routine_id && <Badge tone="info">routine</Badge>}
            </div>

            {task.description ? (
              <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
                {task.description as string}
              </p>
            ) : (
              <p className="text-sm text-zinc-500">No description.</p>
            )}

            <p className="text-xs text-zinc-500">
              Created {format(ist(task.created_at as string), "dd MMM yyyy, HH:mm")}
              {task.updated_at &&
                ` · last changed ${format(ist(task.updated_at as string), "dd MMM yyyy, HH:mm")}`}
            </p>

            <div>
              <TaskEditForm
                id={task.id as string}
                title={task.title as string}
                description={(task.description as string | null) ?? null}
                dueAt={isoToIstInput(task.due_at as string | null)}
                priority={task.priority as string}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Comments{comments.length > 0 && <span className="ml-1 text-zinc-400">· {comments.length}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskComments
            taskId={task.id as string}
            comments={comments}
            members={members}
            myMemberId={me?.id ?? null}
            canManage={canManage}
            defaultOpen
          />
        </CardContent>
      </Card>
    </div>
  );
}
