import { format, isPast, isToday } from "date-fns";
import { Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { ensureRoutineInstances } from "@/lib/routines";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { TaskForm } from "./task-form";
import { TaskFilters } from "./filters";
import { TaskStatusSelect } from "./status-select";
import { AssigneeSelect } from "./assignee-select";
import { TaskComments, type TaskComment } from "./task-comments";

const priorityTone: Record<string, "muted" | "info" | "warning" | "danger"> = {
  low: "muted",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

// Stable per-employee colours for quick visual scanning (left bar + legend dot).
// Full class strings so Tailwind keeps them.
const MEMBER_COLORS = [
  { border: "border-l-rose-400", dot: "bg-rose-400" },
  { border: "border-l-amber-400", dot: "bg-amber-400" },
  { border: "border-l-emerald-400", dot: "bg-emerald-400" },
  { border: "border-l-sky-400", dot: "bg-sky-400" },
  { border: "border-l-violet-400", dot: "bg-violet-400" },
  { border: "border-l-pink-400", dot: "bg-pink-400" },
  { border: "border-l-teal-400", dot: "bg-teal-400" },
  { border: "border-l-orange-400", dot: "bg-orange-400" },
];
const NO_COLOR = { border: "border-l-zinc-300 dark:border-l-zinc-700", dot: "bg-zinc-300" };

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  owner_id: string | null;
  routine_id: string | null;
};

function bucket(t: Task) {
  if (t.status === "done" || t.status === "cancelled") return "done";
  if (!t.due_at) return "upcoming";
  const due = new Date(t.due_at);
  if (isPast(due) && !isToday(due)) return "overdue";
  if (isToday(due)) return "today";
  return "upcoming";
}

// Which buckets a status filter reveals. "pending" = everything not done.
const STATUS_BUCKETS: Record<string, ReadonlyArray<"overdue" | "today" | "upcoming" | "done">> = {
  all: ["overdue", "today", "upcoming", "done"],
  pending: ["overdue", "today", "upcoming"],
  overdue: ["overdue"],
  today: ["today"],
  upcoming: ["upcoming"],
  done: ["done"],
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const me = await getMyMembership();
  const canManage = isAdminOrManager(me?.role);
  const teamMembers = await getTeamMembers();

  // Default to "My tasks": no member param => the current user's tasks.
  // ?member=all shows the whole team.
  const memberParam = sp.member ?? me?.id ?? "all";
  const statusParam = sp.status && STATUS_BUCKETS[sp.status] ? sp.status : "all";
  const visibleBuckets = STATUS_BUCKETS[statusParam];

  const memberOpts = teamMembers.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    return { id: m.id, name: profile?.full_name || "(unnamed)" };
  });
  const memberById = new Map(
    teamMembers.map((m) => {
      const profile = (m.profiles as unknown) as {
        full_name?: string;
        avatar_url?: string;
      } | null;
      return [
        m.id,
        {
          name: profile?.full_name || "(unnamed)",
          avatar_url: profile?.avatar_url ?? null,
        },
      ];
    })
  );

  // Assign each member a stable colour by their position in the roster.
  const colorByMember = new Map(
    teamMembers.map((m, i) => [m.id, MEMBER_COLORS[i % MEMBER_COLORS.length]])
  );
  const colorFor = (ownerId: string | null) =>
    (ownerId ? colorByMember.get(ownerId) : null) ?? NO_COLOR;

  // Member list for the comment form (with avatar)
  const memberListForComments = teamMembers.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string; avatar_url?: string } | null;
    return {
      id: m.id,
      name: profile?.full_name || "(unnamed)",
      avatar_url: profile?.avatar_url ?? null,
    };
  });

  const supabase = await createClient();

  // Materialise this period's routine tasks before reading (idempotent).
  if (me?.team_id) {
    await ensureRoutineInstances(
      supabase,
      me.team_id,
      teamMembers.map((m) => m.id)
    );
  }

  let tasksQuery = supabase
    .from("tasks")
    .select("id, title, description, due_at, priority, status, owner_id, routine_id")
    .order("due_at", { ascending: true, nullsFirst: false });
  if (memberParam !== "all") tasksQuery = tasksQuery.eq("owner_id", memberParam);

  const [{ data: tasksData }, { data: commentsData }] = await Promise.all([
    tasksQuery,
    supabase
      .from("comments")
      .select("id, subject_id, body, author_id, mentioned_ids, attachment_url, created_at")
      .eq("subject_type", "task")
      .order("created_at", { ascending: true }),
  ]);

  const tasks: Task[] = tasksData ?? [];
  const groups: Record<string, Task[]> = { overdue: [], today: [], upcoming: [], done: [] };
  tasks.forEach((t) => groups[bucket(t)].push(t));

  // Count only what the active status filter reveals.
  const shownCount = visibleBuckets.reduce((n, k) => n + groups[k].length, 0);

  const memberOptsAll = teamMembers.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    return { id: m.id, name: profile?.full_name || "(unnamed)" };
  });
  const scopeLabel =
    memberParam === "all"
      ? "All members"
      : memberParam === me?.id
        ? "My tasks"
        : memberById.get(memberParam)?.name ?? "Member";

  // Export reflects the current filter.
  const exportParams = new URLSearchParams();
  if (memberParam !== "all") exportParams.set("member", memberParam);
  if (statusParam !== "all") exportParams.set("status", statusParam);
  const exportHref = exportParams.toString()
    ? `/api/export/tasks?${exportParams.toString()}`
    : "/api/export/tasks";

  // Group comments by task id
  const commentsByTask = new Map<string, TaskComment[]>();
  (commentsData ?? []).forEach((c) => {
    const arr = commentsByTask.get(c.subject_id as string) ?? [];
    arr.push({
      id: c.id as string,
      body: c.body as string,
      author_id: c.author_id as string,
      mentioned_ids: (c.mentioned_ids as string[]) ?? [],
      attachment_url: (c.attachment_url as string) ?? null,
      created_at: c.created_at as string,
    });
    commentsByTask.set(c.subject_id as string, arr);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-zinc-500">
            {shownCount} {statusParam === "all" ? "task" : statusParam} · {scopeLabel}
          </p>
        </div>
        <ExportButton href={exportHref} />
      </div>

      <TaskFilters
        members={memberOptsAll}
        myMemberId={me?.id ?? null}
        member={memberParam}
        status={statusParam}
      />

      {memberParam === "all" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          {memberOptsAll.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${colorFor(m.id).dot}`} />
              {m.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-indigo-500" /> routine
          </span>
        </div>
      )}

      <TaskForm members={memberOpts} myMemberId={me?.id ?? null} />

      {visibleBuckets.map((key) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="capitalize">
              {key}{" "}
              {groups[key].length > 0 && (
                <span className="ml-1 text-zinc-400">· {groups[key].length}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groups[key].length === 0 ? (
              <EmptyState title={`No ${key} tasks`} />
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {groups[key].map((t) => {
                  const owner = t.owner_id ? memberById.get(t.owner_id) : null;
                  const taskComments = commentsByTask.get(t.id) ?? [];
                  const color = colorFor(t.owner_id);
                  return (
                    <li
                      key={t.id}
                      className={`flex items-start gap-3 py-3 pl-3 border-l-4 ${color.border} ${
                        t.routine_id ? "bg-indigo-50/60 dark:bg-indigo-950/20" : ""
                      }`}
                    >
                      <div className="mt-0.5">
                        <TaskStatusSelect id={t.id} status={t.status} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={t.status === "done" ? "line-through text-zinc-500" : ""}>
                          {t.routine_id && (
                            <Repeat className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-indigo-500" />
                          )}
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
                          {t.routine_id && <Badge tone="info">routine</Badge>}
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                            <Avatar
                              src={owner?.avatar_url}
                              name={owner?.name}
                              size={18}
                            />
                            <AssigneeSelect id={t.id} value={t.owner_id} members={memberOpts} />
                          </span>
                        </div>
                        <div className="mt-2">
                          <TaskComments
                            taskId={t.id}
                            comments={taskComments}
                            members={memberListForComments}
                            myMemberId={me?.id ?? null}
                            canManage={canManage}
                          />
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
