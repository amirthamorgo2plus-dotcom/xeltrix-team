import Link from "next/link";

export function Tabs({
  current,
  monthCursor,
}: {
  current: "monthly" | "dashboard";
  monthCursor?: string; // yyyy-mm
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href={`/payments${monthCursor ? `?month=${monthCursor}` : ""}`}
        className={`rounded px-3 py-1 text-sm transition-colors ${
          current === "monthly"
            ? "bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-300"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        Monthly
      </Link>
      <Link
        href="/payments/dashboard"
        className={`rounded px-3 py-1 text-sm transition-colors ${
          current === "dashboard"
            ? "bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-300"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        Dashboard
      </Link>
    </div>
  );
}
