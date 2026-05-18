import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonthCursor } from "./helpers";

export function MonthNav({ monthCursorYm }: { monthCursorYm: string }) {
  // monthCursorYm: "yyyy-mm"
  const prev = shiftMonthCursor(monthCursorYm, -1);
  const next = shiftMonthCursor(monthCursorYm, 1);
  const label = new Date(`${monthCursorYm}-01`).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href={`/payments?month=${prev}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-[140px] px-2 text-center text-sm font-medium tabular-nums">
        {label}
      </span>
      <Link
        href={`/payments?month=${next}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function YearNav({ year }: { year: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href={`/payments/dashboard?year=${year - 1}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="Previous year"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-[80px] px-2 text-center text-sm font-medium tabular-nums">
        {year}
      </span>
      <Link
        href={`/payments/dashboard?year=${year + 1}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="Next year"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
