/**
 * Ordering for the task table. Kept out of the component so it can be
 * exercised directly — the demo data has no unscheduled tasks, so a bug in
 * the null handling would not show up by clicking around.
 */

export type SortKey = "title" | "assignee" | "priority" | "due" | "status";
export const SORT_KEYS: SortKey[] = ["title", "assignee", "priority", "due", "status"];

export type SortableTask = {
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
  owner_id: string | null;
};

// These are enums, so alphabetical order would read low, medium, high, urgent
// — meaningless. Rank them the way people think about them.
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_RANK: Record<string, number> = { todo: 0, in_progress: 1, done: 2, cancelled: 3 };

function compare(
  a: SortableTask,
  b: SortableTask,
  key: SortKey,
  nameOf: (id: string | null) => string
): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "assignee":
      return nameOf(a.owner_id).localeCompare(nameOf(b.owner_id));
    case "priority":
      return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    case "status":
      return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    case "due":
      return (a.due_at ?? "").localeCompare(b.due_at ?? "");
  }
}

export function sortTasks<T extends SortableTask>(
  tasks: readonly T[],
  key: SortKey,
  dir: "asc" | "desc",
  nameOf: (id: string | null) => string
): T[] {
  return [...tasks].sort((a, b) => {
    // A task with no due date is unscheduled, not "earlier than everything".
    // This sits OUTSIDE the direction flip on purpose: inverting it would
    // float every undated task to the top on the descending click, which is
    // the opposite of useful.
    if (key === "due") {
      const an = !a.due_at;
      const bn = !b.due_at;
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;
    }
    const r = compare(a, b, key, nameOf);
    return dir === "asc" ? r : -r;
  });
}
