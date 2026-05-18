"use client";

import { useTransition } from "react";
import { Check, Circle, Loader, X } from "lucide-react";
import { setTaskStatus } from "./actions";

const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export function TaskStatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, start] = useTransition();

  const Icon =
    status === "done"
      ? Check
      : status === "in_progress"
        ? Loader
        : status === "cancelled"
          ? X
          : Circle;

  const iconColor =
    status === "done"
      ? "text-emerald-500"
      : status === "in_progress"
        ? "text-amber-500"
        : status === "cancelled"
          ? "text-zinc-400"
          : "text-zinc-400";

  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-4 w-4 ${iconColor} ${pending ? "animate-pulse" : ""}`} />
      <select
        disabled={pending}
        value={status}
        suppressHydrationWarning
        onChange={(e) => start(() => setTaskStatus(id, e.target.value))}
        className="h-8 rounded-md border border-zinc-300 bg-transparent px-2 text-xs hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
