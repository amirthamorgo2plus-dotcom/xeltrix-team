import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "success" | "warning" | "danger" | null;
  href?: string;
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
        <div className={cn("text-3xl font-semibold", toneClass)}>{value}</div>
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
