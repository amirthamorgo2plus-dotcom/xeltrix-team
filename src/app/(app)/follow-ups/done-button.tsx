"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markDone } from "./actions";

export function DoneButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => markDone(id))}
      title="Mark done"
      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:bg-emerald-100 hover:text-emerald-700 dark:border-zinc-700"
    >
      <Check className="h-3 w-3" />
    </button>
  );
}
