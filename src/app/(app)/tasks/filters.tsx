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

export function TaskFilters({
  members,
  myMemberId,
  member,
  status,
}: {
  members: { id: string; name: string }[];
  myMemberId: string | null;
  member: string; // current selection: a member id or "all"
  status: string; // current selection or "all"
}) {
  const router = useRouter();

  function go(next: { member?: string; status?: string }) {
    const params = new URLSearchParams();
    const m = next.member ?? member;
    const s = next.status ?? status;
    if (m && m !== "all") params.set("member", m);
    else params.set("member", "all"); // explicit so it doesn't snap back to "My tasks"
    if (s && s !== "all") params.set("status", s);
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
    </div>
  );
}
