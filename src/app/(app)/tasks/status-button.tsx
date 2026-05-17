"use client";

import { useTransition } from "react";
import { Check, Circle, Loader } from "lucide-react";
import { setTaskStatus } from "./actions";

export function TaskStatusButton({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();

  const next = status === "done" ? "todo" : status === "todo" ? "in_progress" : "done";

  const Icon =
    status === "done" ? Check :
    status === "in_progress" ? Loader :
    Circle;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setTaskStatus(id, next))}
      title={`Mark ${next}`}
      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}
