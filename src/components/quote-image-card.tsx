"use client";

import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { Card } from "@/components/ui/card";

// Dashboard card that shows the admin-uploaded quote image as a thumbnail
// next to a quote symbol. Clicking opens a full-screen lightbox.
export function QuoteImageCard({
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
      <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-emerald-950/20">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
          aria-label="View quote of the day"
        >
          <Quote
            className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={caption ?? "Quote of the day"}
            className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-black/5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {caption?.trim() ? caption : "Quote of the day"}
            </p>
            <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
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
            alt={caption ?? "Quote of the day"}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
