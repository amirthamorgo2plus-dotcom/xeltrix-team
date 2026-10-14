import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import { ArrowDown, ArrowUp, ChevronsUpDown, MessageSquare, Repeat } from "lucide-react";
import { ist } from "@/lib/ist";
import { memberColor } from "@/lib/member-colors";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { sortTasks, type SortKey } from "@/lib/task-sort";
import { TaskRow } from "./task-row";

export type TableTask = {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
  owner_id: string | null;
  routine_id: string | null;
};

const priorityTone: Record<string, "muted" | "info" | "warning" | "danger"> = {
  low: "muted",
  medium: "info",
  high: "warning",
  urgent: "danger",
};


const STATUS_META: Record<string, { label: string; tone: "muted" | "info" | "warning" | "success" }> =
  {
    todo: { label: "To do", tone: "muted" },
    in_progress: { label: "In progress", tone: "warning" },
    done: { label: "Done", tone: "success" },
    cancelled: { label: "Cancelled", tone: "muted" },
  };

function SortHeader({
  label,
  colKey,
  sort,
  dir,
  query,
  right,
}: {
  label: string;
  colKey: SortKey;
  sort: SortKey;
  dir: "asc" | "desc";
  query: Record<string, string>;
  right?: boolean;
}) {
  const active = sort === colKey;
  // Clicking the active column flips it; a new column starts ascending.
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams({ ...query, sort: colKey, dir: nextDir });
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <TH right={right}>
      <Link
        href={`/tasks?${params.toString()}`}
        className={`inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 ${
          active ? "text-zinc-900 dark:text-zinc-100" : ""
        }`}
        scroll={false}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "" : "text-zinc-400"}`} />
      </Link>
    </TH>
  );
}

export function TasksTable({
  tasks,
  memberById,
  commentCounts,
  sort,
  dir,
  query,
}: {
  tasks: TableTask[];
  memberById: Map<string, { name: string; avatar_url: string | null }>;
  commentCounts: Map<string, number>;
  sort: SortKey;
  dir: "asc" | "desc";
  /** The current filter params, so sorting does not drop them. */
  query: Record<string, string>;
}) {
  const nameOf = (id: string | null) => (id ? memberById.get(id)?.name ?? "" : "");
  const rows = sortTasks(tasks, sort, dir, nameOf);

  if (rows.length === 0) return <EmptyState title="No tasks match these filters" />;

  return (
    <>
      {/* Phones get stacked cards. The table is 809px wide, and sideways
          swiping through six columns to read one task is worse than reading
          it top to bottom. Same rows, same order, same sort — only the shape
          differs, so a link shared from either view lands in the same place. */}
      <ul className="divide-y divide-zinc-200 sm:hidden dark:divide-zinc-800">
        {rows.map((t) => {
          const owner = t.owner_id ? memberById.get(t.owner_id) : null;
          const color = memberColor(t.owner_id);
          const due = t.due_at ? new Date(t.due_at) : null;
          const overdue =
            due !== null &&
            isPast(due) &&
            !isToday(due) &&
            t.status !== "done" &&
            t.status !== "cancelled";
          const status = STATUS_META[t.status] ?? { label: t.status, tone: "muted" as const };
          const count = commentCounts.get(t.id) ?? 0;
          const done = t.status === "done" || t.status === "cancelled";
          return (
            <li key={t.id} className={`border-l-4 ${color.border}`}>
              <Link href={`/tasks/${t.id}`} className="block px-3 py-3">
                <div
                  className={`text-sm ${done ? "text-zinc-500 line-through" : "font-medium"}`}
                >
                  {t.routine_id && (
                    <Repeat className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-indigo-500" />
                  )}
                  {t.title}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <Badge tone={priorityTone[t.priority] ?? "muted"}>{t.priority}</Badge>
                  {due ? (
                    <span className={overdue ? "font-medium text-red-500" : "text-zinc-500"}>
                      {format(ist(due), "dd MMM")}
                      {overdue && " · overdue"}
                    </span>
                  ) : (
                    <span className="text-zinc-500">no due date</span>
                  )}
                  {count > 0 && (
                    <span className="inline-flex items-center gap-1 text-zinc-500">
                      <MessageSquare className="h-3 w-3" />
                      {count}
                    </span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1.5 text-zinc-400">
                    <Avatar src={owner?.avatar_url} name={owner?.name} size={18} />
                    {owner?.name ?? "unassigned"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
      <Table>
        <THead>
          <TR hover={false}>
            <SortHeader label="Title" colKey="title" sort={sort} dir={dir} query={query} />
            <SortHeader label="Assigned" colKey="assignee" sort={sort} dir={dir} query={query} />
            <SortHeader label="Priority" colKey="priority" sort={sort} dir={dir} query={query} />
            <SortHeader label="Due" colKey="due" sort={sort} dir={dir} query={query} />
            <SortHeader label="Status" colKey="status" sort={sort} dir={dir} query={query} />
            <TH right>Comments</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((t) => {
            const owner = t.owner_id ? memberById.get(t.owner_id) : null;
            const color = memberColor(t.owner_id);
            const due = t.due_at ? new Date(t.due_at) : null;
            const overdue =
              due !== null &&
              isPast(due) &&
              !isToday(due) &&
              t.status !== "done" &&
              t.status !== "cancelled";
            const status = STATUS_META[t.status] ?? { label: t.status, tone: "muted" as const };
            const count = commentCounts.get(t.id) ?? 0;
            const done = t.status === "done" || t.status === "cancelled";

            return (
              <TaskRow key={t.id} href={`/tasks/${t.id}`}>
                <TD className={`max-w-[420px] border-l-4 ${color.border}`}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className={`block truncate hover:underline ${
                      done ? "text-zinc-500 line-through" : "font-medium"
                    }`}
                  >
                    {t.routine_id && (
                      <Repeat className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-indigo-500" />
                    )}
                    {t.title}
                  </Link>
                </TD>
                <TD>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <Avatar
                      src={owner?.avatar_url}
                      name={owner?.name}
                      size={20}
                      className={`ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950 ${color.ring}`}
                    />
                    <span className={owner ? "" : "text-zinc-500"}>
                      {owner?.name ?? "unassigned"}
                    </span>
                  </span>
                </TD>
                <TD>
                  <Badge tone={priorityTone[t.priority] ?? "muted"}>{t.priority}</Badge>
                </TD>
                <TD>
                  {due ? (
                    <span
                      className={`whitespace-nowrap ${overdue ? "font-medium text-red-500" : "text-zinc-500"}`}
                    >
                      {format(ist(due), "dd MMM yyyy")}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </TD>
                <TD>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </TD>
                <TD right>
                  {count > 0 ? (
                    <span className="inline-flex items-center gap-1 text-zinc-500">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {count}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </TD>
              </TaskRow>
            );
          })}
        </TBody>
      </Table>
      </div>
    </>
  );
}
