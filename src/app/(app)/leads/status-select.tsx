"use client";

import { useTransition } from "react";
import { updateLeadStatus } from "./actions";

const STATUSES = ["new", "contacted", "qualified", "unqualified", "converted", "lost"];

export function LeadStatusSelect({ id, value }: { id: string; value: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      suppressHydrationWarning
      onChange={(e) => start(() => updateLeadStatus(id, e.target.value))}
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
