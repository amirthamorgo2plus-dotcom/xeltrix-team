import Link from "next/link";
import { ArrowDownAZ, ArrowUpZA, Clock } from "lucide-react";

export type SortKey = "newest" | "name_asc" | "name_desc";

// A→Z / Z→A (+ optional Newest) toggle rendered as plain links. No client
// hooks (no useSearchParams) — the server page passes its current params in,
// so this stays a Server Component with zero runtime/Suspense risk.
export function SortControl({
  current,
  basePath,
  params = {},
  withNewest = true,
  paramName = "sort",
}: {
  current: SortKey;
  basePath: string;
  // Other query params to preserve on the URL (e.g. range, status, q).
  params?: Record<string, string | undefined>;
  withNewest?: boolean;
  paramName?: string;
}) {
  const defaultKey: SortKey = withNewest ? "newest" : "name_asc";

  function hrefFor(value: SortKey) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    if (value === defaultKey) sp.delete(paramName);
    else sp.set(paramName, value);
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
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
          <Link
            key={key}
            href={hrefFor(key)}
            scroll={false}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

// Shared helper so server pages resolve a sort param the same way.
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
