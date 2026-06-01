"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowDownAZ, ArrowUpZA, Clock } from "lucide-react";

export type SortKey = "newest" | "name_asc" | "name_desc";

// Reusable A→Z / Z→A (+ optional Newest) toggle that drives a `?sort=` query
// param. Server pages read the param and order accordingly.
export function SortControl({
  current,
  withNewest = true,
  param = "sort",
}: {
  current: string;
  withNewest?: boolean;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(value: SortKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === (withNewest ? "newest" : "name_asc")) params.delete(param);
    else params.set(param, value);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  const options: Array<{ key: SortKey; label: string; icon: typeof Clock }> = [
    ...(withNewest
      ? [{ key: "newest" as const, label: "Newest", icon: Clock }]
      : []),
    { key: "name_asc", label: "A–Z", icon: ArrowDownAZ },
    { key: "name_desc", label: "Z–A", icon: ArrowUpZA },
  ];

  return (
    <div className="inline-flex items-center rounded-md border border-zinc-300 p-0.5 text-xs dark:border-zinc-700">
      {options.map(({ key, label, icon: Icon }) => {
        const active = current === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => set(key)}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Shared helper so server pages resolve a sort param the same way.
// `nameColumn`/`dateColumn` let each page map to its own columns.
export function resolveSort(
  raw: string | undefined,
  opts: { withNewest?: boolean; nameColumn?: string; dateColumn?: string } = {}
): { key: SortKey; column: string; ascending: boolean } {
  const { withNewest = true, nameColumn = "name", dateColumn = "created_at" } =
    opts;
  const fallback: SortKey = withNewest ? "newest" : "name_asc";
  const key = (["newest", "name_asc", "name_desc"].includes(raw ?? "")
    ? raw
    : fallback) as SortKey;
  if (key === "name_asc") return { key, column: nameColumn, ascending: true };
  if (key === "name_desc") return { key, column: nameColumn, ascending: false };
  return { key, column: dateColumn, ascending: false };
}
