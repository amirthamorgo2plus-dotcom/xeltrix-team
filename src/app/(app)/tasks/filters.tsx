"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function TaskFilters({
  members,
  myMemberId,
  member,
  status,
  priority,
  view,
  sort,
  dir,
}: {
  members: { id: string; name: string }[];
  myMemberId: string | null;
  member: string; // current selection: a member id or "all"
  status: string; // current selection or "all"
  priority: string; // current selection or "all"
  view: "list" | "table";
  sort: string;
  dir: string;
}) {
  const router = useRouter();

  // Changing a filter must not throw away the view or its sort, or picking a
  // priority would bounce the user out of the table and back to the list.
  function go(next: { member?: string; status?: string; priority?: string }) {
    const params = new URLSearchParams();
    const m = next.member ?? member;
    const s = next.status ?? status;
    const p = next.priority ?? priority;
    if (m && m !== "all") params.set("member", m);
    else params.set("member", "all"); // explicit so it doesn't snap back to "My tasks"
    if (s && s !== "all") params.set("status", s);
    if (p && p !== "all") params.set("priority", p);
    if (view === "table") {
      params.set("view", "table");
      params.set("sort", sort);
      params.set("dir", dir);
    }
    router.push(`/tasks?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Employee</label>
        <Select
          value={member}
          onChange={(e) => go({ member: e.target.value })}
          className="h-9 w-52"
        >
          {myMemberId && <option value={myMemberId}>My tasks</option>}
          <option value="all">All members</option>
          {members
            .filter((m) => m.id !== myMemberId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Status</label>
        <Select
          value={status}
          onChange={(e) => go({ status: e.target.value })}
          className="h-9 w-44"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Priority</label>
        <Select
          value={priority}
          onChange={(e) => go({ priority: e.target.value })}
          className="h-9 w-40"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
