import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      title={name ?? undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? ""}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-medium">{initials(name)}</span>
      )}
    </span>
  );
}
