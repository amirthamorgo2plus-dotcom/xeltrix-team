import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import { ist } from "@/lib/ist";
import { Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { ensureRoutineInstances } from "@/lib/routines";
import { memberColor } from "@/lib/member-colors";
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
import { SORT_KEYS, type SortKey } from "@/lib/task-sort";
import { TasksTable } from "./tasks-table";
import { TaskStats, type Tile } from "./task-stats";

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
  routine_id: string | null;
};

type Bucket = "overdue" | "today" | "upcoming" | "unscheduled" | "done";

function bucket(t: Task): Bucket {
  if (t.status === "done" || t.status === "cancelled") return "done";
  // Its own bucket rather than "upcoming": a task with no due date is never
  // due, so it can never be overdue or due today, and it used to hide among
  // tasks that are genuinely scheduled.
  if (!t.due_at) return "unscheduled";
  const due = new Date(t.due_at);
  if (isPast(due) && !isToday(due)) return "overdue";
  if (isToday(due)) return "today";
  return "upcoming";
}

const isOpen = (t: Task) => t.status === "todo" || t.status === "in_progress";

// Overdue AND high-priority. Overdue alone is 44 tasks, which is a backlog;
// this is the subset that is actually supposed to hurt.
const isCritical = (t: Task) =>
  isOpen(t) && bucket(t) === "overdue" && (t.priority === "high" || t.priority === "urgent");

// Which buckets a status filter reveals. "pending" = everything not done.
const PRIORITIES = ["low", "medium", "high", "urgent"];

const STATUS_BUCKETS: Record<string, ReadonlyArray<Bucket>> = {
  all: ["overdue", "today", "upcoming", "unscheduled", "done"],
  pending: ["overdue", "today", "upcoming", "unscheduled"],
  critical: ["overdue"],
  overdue: ["overdue"],
  today: ["today"],
  upcoming: ["upcoming"],
  unscheduled: ["unscheduled"],
  done: ["done"],
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    member?: string;
    status?: string;
    priority?: string;
    view?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const sp = await searchParams;
  const me = await getMyMembership();
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const canManage = isAdminOrManager(me?.role);
  const teamMembers = await getTeamMembers();

  // Default to "My tasks": no member param => the current user's tasks.
  // ?member=all shows the whole team.
  const memberParam = sp.member ?? me?.id ?? "all";
  const statusParam = sp.status && STATUS_BUCKETS[sp.status] ? sp.status : "all";
  const visibleBuckets = STATUS_BUCKETS[statusParam];
  const priorityParam = PRIORITIES.includes(sp.priority ?? "") ? sp.priority! : "all";
  // The grouped list answers "what should I do next"; the table answers "what
  // is the team carrying". Different jobs, so both stay.
  const view = sp.view === "table" ? "table" : "list";
  const sort = (SORT_KEYS as string[]).includes(sp.sort ?? "") ? (sp.sort as SortKey) : "due";
  const dir = sp.dir === "desc" ? "desc" : "asc";

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
    .eq("team_id", teamId)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (memberParam !== "all") tasksQuery = tasksQuery.eq("owner_id", memberParam);
  if (priorityParam !== "all") tasksQuery = tasksQuery.eq("priority", priorityParam);

  const [{ data: tasksData }, { data: commentsData }] = await Promise.all([
    tasksQuery,
    supabase
      .from("comments")
      .select("id, subject_id, body, author_id, mentioned_ids, attachment_url, created_at")
      .eq("subject_type", "task")
      .order("created_at", { ascending: true }),
  ]);

  const tasks: Task[] = tasksData ?? [];
  // Tiles describe everything in scope for the current person and priority,
  // not what the status filter has narrowed to — otherwise clicking a tile
  // would change the numbers the tiles are reporting.
  const stats = {
    critical: tasks.filter(isCritical).length,
    overdue: tasks.filter((t) => isOpen(t) && bucket(t) === "overdue").length,
    today: tasks.filter((t) => isOpen(t) && bucket(t) === "today").length,
    unscheduled: tasks.filter((t) => isOpen(t) && bucket(t) === "unscheduled").length,
    pending: tasks.filter(isOpen).length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  // "Critical" is not a time bucket but a cut across one, so it narrows the
  // list before grouping rather than selecting a different bucket.
  const visibleTasks = statusParam === "critical" ? tasks.filter(isCritical) : tasks;

  const groups: Record<string, Task[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    unscheduled: [],
    done: [],
  };
  visibleTasks.forEach((t) => groups[bucket(t)].push(t));

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
  if (priorityParam !== "all") exportParams.set("priority", priorityParam);
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

  const commentCounts = new Map<string, number>();
  commentsByTask.forEach((list, taskId) => commentCounts.set(taskId, list.length));

  // The table honours the same status filter the buckets do.
  const tableTasks = visibleBuckets.flatMap((k) => groups[k]);

  // Carried onto every sort link so sorting never drops the active filters.
  const tableQuery: Record<string, string> = { view: "table" };
  if (memberParam !== "all") tableQuery.member = memberParam;
  else tableQuery.member = "all";
  if (statusParam !== "all") tableQuery.status = statusParam;
  if (priorityParam !== "all") tableQuery.priority = priorityParam;

  const statusHref = (next: string) => {
    const q = new URLSearchParams();
    q.set("member", memberParam);
    if (next !== "all") q.set("status", next);
    if (priorityParam !== "all") q.set("priority", priorityParam);
    if (view === "table") {
      q.set("view", "table");
      q.set("sort", sort);
      q.set("dir", dir);
    }
    return `/tasks?${q.toString()}`;
  };

  const tiles: Tile[] = [
    { key: "critical", label: "Critical", value: stats.critical, href: statusHref("critical"),
      hint: "Overdue and high or urgent priority" },
    { key: "overdue", label: "Overdue", value: stats.overdue, href: statusHref("overdue"),
      hint: "Open and past its due date" },
    { key: "today", label: "Due today", value: stats.today, href: statusHref("today") },
    { key: "unscheduled", label: "Unscheduled", value: stats.unscheduled,
      href: statusHref("unscheduled"),
      hint: "Open with no due date — never appears in overdue or due today" },
    { key: "pending", label: "Pending", value: stats.pending, href: statusHref("pending"),
      hint: "To do and in progress" },
    { key: "done", label: "Completed", value: stats.done, href: statusHref("done") },
  ];

  const viewHref = (next: "list" | "table") => {
    const q = new URLSearchParams();
    q.set("member", memberParam);
    if (statusParam !== "all") q.set("status", statusParam);
    if (priorityParam !== "all") q.set("priority", priorityParam);
    if (next === "table") {
      q.set("view", "table");
      q.set("sort", sort);
      q.set("dir", dir);
    }
    return `/tasks?${q.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-zinc-500">
            {shownCount} {statusParam === "all" ? "task" : statusParam} · {scopeLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 text-sm dark:border-zinc-700">
            <Link
              href={viewHref("list")}
              className={`px-3 py-1.5 ${
                view === "list"
                  ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              List
            </Link>
            <Link
              href={viewHref("table")}
              className={`px-3 py-1.5 ${
                view === "table"
                  ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Table
            </Link>
          </div>
          <ExportButton href={exportHref} />
        </div>
      </div>

      <TaskStats tiles={tiles} active={statusParam} />

      <TaskFilters
        members={memberOptsAll}
        myMemberId={me?.id ?? null}
        member={memberParam}
        status={statusParam}
        priority={priorityParam}
        view={view}
        sort={sort}
        dir={dir}
      />

      {memberParam === "all" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          {memberOptsAll.map((m) => (
            <Link
              key={m.id}
              href={`/tasks?member=${m.id}`}
              className="inline-flex items-center gap-1.5 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${memberColor(m.id).dot}`} />
              {m.name}
            </Link>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-indigo-500" /> routine
          </span>
        </div>
      )}

      <TaskForm members={memberOpts} myMemberId={me?.id ?? null} />

      {view === "table" && (
        <Card>
          <CardContent className="px-0 sm:px-0">
            <TasksTable
              tasks={tableTasks}
              memberById={memberById}
              commentCounts={commentCounts}
              sort={sort}
              dir={dir}
              query={tableQuery}
            />
          </CardContent>
        </Card>
      )}

      {view === "list" &&
        visibleBuckets.map((key) => (
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
                  const color = memberColor(t.owner_id);
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
                        <Link
                          href={`/tasks/${t.id}`}
                          className={`block hover:underline ${
                            t.status === "done" ? "line-through text-zinc-500" : ""
                          }`}
                        >
                          {t.routine_id && (
                            <Repeat className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-indigo-500" />
                          )}
                          {t.title}
                        </Link>
                        {t.description && (
                          <div className="text-xs text-zinc-500">{t.description}</div>
                        )}
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {t.due_at && (
                            <span className="text-xs text-zinc-500">
                              Due {format(ist(t.due_at), "dd MMM, HH:mm")}
                            </span>
                          )}
                          <Badge tone={priorityTone[t.priority] ?? "muted"}>{t.priority}</Badge>
                          {t.routine_id && <Badge tone="info">routine</Badge>}
                          <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                            {t.owner_id ? (
                              <Link
                                href={`/tasks?member=${t.owner_id}`}
                                title={`Show only ${owner?.name ?? "this member"}'s tasks`}
                                // Padding pulled back by the same amount: an
                                // 18px avatar is a 19px tap target otherwise,
                                // which no thumb can hit reliably.
                                className="-m-1.5 inline-flex items-center p-1.5"
                              >
                                <Avatar
                                  src={owner?.avatar_url}
                                  name={owner?.name}
                                  size={18}
                                  className={`ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950 ${color.ring}`}
                                />
                              </Link>
                            ) : (
                              <Avatar src={owner?.avatar_url} name={owner?.name} size={18} />
                            )}
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
