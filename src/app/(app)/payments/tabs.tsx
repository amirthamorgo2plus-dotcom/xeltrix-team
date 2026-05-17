import Link from "next/link";
import { Input } from "@/components/ui/input";

export function Tabs({
  current,
  monthCursor,
}: {
  current: "monthly" | "dashboard";
  monthCursor?: string; // yyyy-mm
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="inline-flex rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href={`/payments${monthCursor ? `?month=${monthCursor}` : ""}`}
          className={`rounded px-3 py-1 text-sm ${
            current === "monthly"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Monthly
        </Link>
        <Link
          href="/payments/dashboard"
          className={`rounded px-3 py-1 text-sm ${
            current === "dashboard"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Dashboard
        </Link>
      </div>

      {current === "monthly" && (
        <form action="/payments" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Month
            <Input
              name="month"
              type="month"
              defaultValue={monthCursor}
              className="h-9 w-40"
            />
          </label>
          <button className="h-9 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            Go
          </button>
        </form>
      )}
    </div>
  );
}
