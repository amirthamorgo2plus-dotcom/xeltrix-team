"use client";

import { useTransition } from "react";
import { reassignTask } from "./actions";

export function AssigneeSelect({
  id,
  value,
  members,
}: {
  id: string;
  value: string | null;
  members: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      value={value ?? ""}
      disabled={pending}
      suppressHydrationWarning
      onChange={(e) => start(() => reassignTask(id, e.target.value))}
      className="h-7 rounded-md border border-zinc-300 bg-transparent px-1 text-xs dark:border-zinc-700"
      title="Reassign"
    >
      <option value="">— unassigned —</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
