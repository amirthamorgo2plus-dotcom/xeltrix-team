"use client";

import { useTransition } from "react";
import { setComplaintStatus } from "./actions";

const STATUSES = ["open", "in_progress", "resolved", "closed"];

export function ComplaintStatusSelect({ id, value }: { id: string; value: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => start(() => setComplaintStatus(id, e.target.value))}
      className="h-8 rounded-md border border-zinc-300 bg-transparent px-2 text-xs dark:border-zinc-700"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
