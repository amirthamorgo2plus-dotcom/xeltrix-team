"use client";

import { useTransition } from "react";
import { setOpportunityStage } from "./actions";

const STAGES = ["prospecting", "qualification", "proposal", "negotiation", "won", "lost"];

export function StageSelect({ id, value }: { id: string; value: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => start(() => setOpportunityStage(id, e.target.value))}
      className="h-7 rounded-md border border-zinc-300 bg-transparent px-1 text-xs dark:border-zinc-700"
    >
      {STAGES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}
