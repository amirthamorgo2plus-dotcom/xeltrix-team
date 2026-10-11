import Link from "next/link";
import { cn } from "@/lib/utils";

export type Tile = {
  key: string;
  label: string;
  value: number;
  href: string;
  /** What the number means when it is not zero. */
  hint?: string;
};

const TONE: Record<string, { value: string; ring: string }> = {
  critical: { value: "text-red-500", ring: "ring-red-500/40" },
  overdue: { value: "text-amber-500", ring: "ring-amber-500/40" },
  today: { value: "text-sky-500", ring: "ring-sky-500/40" },
  unscheduled: { value: "text-violet-500", ring: "ring-violet-500/40" },
  pending: { value: "text-zinc-100", ring: "ring-zinc-400/40" },
  done: { value: "text-[#b5c76a]", ring: "ring-[#b5c76a]/40" },
};

/**
 * Counts that are also the filter for themselves — clicking a tile narrows the
 * list to exactly what it counted.
 *
 * A number that reads the same every day is decoration, so the tiles that earn
 * their place are the ones that should normally be near zero: critical,
 * overdue, unscheduled. Pending and Done are context for those, not the point.
 * Nothing is shown as a percentage of the total: with 9 done out of 71 a
 * completion gauge would read 13% this month and 13% next month.
 */
export function TaskStats({ tiles, active }: { tiles: Tile[]; active: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => {
        const tone = TONE[t.key] ?? TONE.pending;
        const isActive = active === t.key;
        const empty = t.value === 0;
        return (
          <Link
            key={t.key}
            href={t.href}
            title={t.hint}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60",
              isActive && `ring-2 ${tone.ring}`
            )}
          >
            <p className="text-xs text-zinc-500">{t.label}</p>
            <p
              className={cn(
                "mt-0.5 text-2xl font-semibold tabular-nums",
                empty ? "text-zinc-400 dark:text-zinc-600" : tone.value
              )}
            >
              {t.value}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
