import Link from "next/link";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/date-range";

export function RangeFilter({
  basePath,
  current,
  extraParams,
}: {
  basePath: string;
  current: string;
  extraParams?: Record<string, string | undefined>;
}) {
  function urlFor(key: RangeKey) {
    const params = new URLSearchParams();
    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    }
    params.set("range", key);
    return `${basePath}?${params}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {RANGE_OPTIONS.map((opt) => {
        const active = opt.key === current;
        return (
          <Link
            key={opt.key}
            href={urlFor(opt.key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              active
                ? "border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
