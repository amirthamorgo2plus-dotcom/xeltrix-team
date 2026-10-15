"use client";

import { useState, useTransition } from "react";
import { MessageSquareWarning, Trash2 } from "lucide-react";
import { deleteFeedback, raiseComplaintFromFeedback } from "./actions";

export function RaiseComplaint({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await raiseComplaintFromFeedback(id);
            setError(res?.error ?? null);
          })
        }
        className="inline-flex items-center gap-1 rounded-md border border-amber-600/50 px-2 py-1 text-xs text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
      >
        <MessageSquareWarning className="h-3.5 w-3.5" />
        {pending ? "Raising…" : "Raise complaint"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  );
}

export function DeleteFeedback({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Delete feedback"
        className="p-1.5 text-zinc-500 hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await deleteFeedback(id);
            if (res?.error) {
              setError(res.error);
              setConfirming(false);
            }
          })
        }
        className="text-red-400 hover:underline disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-zinc-500 hover:underline">
        Cancel
      </button>
      {error && <span className="text-red-500">{error}</span>}
    </span>
  );
}
