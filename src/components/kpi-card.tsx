import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  tone,
  href,
  secondary,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "success" | "warning" | "danger" | null;
  href?: string;
  // When provided, renders a second prominent line (e.g. with-tax vs without-tax).
  secondary?: { label: string; value: string | number };
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-red-600 dark:text-red-400"
          : "text-zinc-900 dark:text-zinc-50";

  const body = (
    <Card
      className={cn(
        "transition-all",
        href &&
          "cursor-pointer hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-500/10 dark:hover:border-emerald-500/50"
      )}
    >
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <div className={cn("text-2xl font-semibold tracking-tight", toneClass)}>
          {value}
        </div>
        {secondary && (
          <div className="mt-1 flex items-baseline gap-2 text-sm">
            <span className="text-zinc-500">{secondary.label}</span>
            <span className="font-medium text-zinc-700 tabular-nums dark:text-zinc-300">
              {secondary.value}
            </span>
          </div>
        )}
      </CardHeader>
      {hint && (
        <CardContent>
          <p className="text-xs text-zinc-500">{hint}</p>
        </CardContent>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
