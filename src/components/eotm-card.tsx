"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";

// Dashboard card showing the admin-uploaded Employee of the Month image as a
// thumbnail. Clicking opens a full-screen lightbox. Mirrors QuoteImageCard.
export function EotmCard({
  imageUrl,
  caption,
}: {
  imageUrl: string;
  caption: string | null;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Card className="overflow-hidden border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 dark:border-amber-900/40 dark:from-amber-950/40 dark:via-zinc-950 dark:to-amber-950/20">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-amber-50/50 dark:hover:bg-amber-950/30"
          aria-label="View Rewards"
        >
          <Trophy
            className="h-6 w-6 shrink-0 text-amber-500 dark:text-amber-400"
            aria-hidden
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={caption ?? "Rewards"}
            className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-black/5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Rewards
            </p>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {caption?.trim() ? caption : "Tap to view"}
            </p>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-400/80">
              Click to view
            </p>
          </div>
        </button>
      </Card>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={caption ?? "Rewards"}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
