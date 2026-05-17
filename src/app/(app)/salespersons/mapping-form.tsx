"use client";

import { useTransition } from "react";
import { setSalespersonMapping } from "./actions";

export function MappingForm({
  salespersonName,
  currentMemberId,
  members,
}: {
  salespersonName: string;
  currentMemberId: string | null;
  members: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={currentMemberId ?? ""}
      disabled={pending}
      suppressHydrationWarning
      onChange={(e) =>
        start(() =>
          setSalespersonMapping(
            salespersonName,
            e.target.value === "" ? null : e.target.value
          )
        )
      }
      className="h-8 rounded-md border border-zinc-300 bg-transparent px-2 text-xs dark:border-zinc-700"
    >
      <option value="">— unmapped —</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
