import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HUB_CATEGORIES, HUB_LINKS, type HubLink } from "./links";

// Server-rendered, re-checked on each load (cheap for a 7-person tool).
export const dynamic = "force-dynamic";

// Ping a URL server-side (no CORS limits here). Returns up/down/unknown.
// HEAD first (fast); some servers reject HEAD, so fall back to a GET. A 4s
// timeout keeps one slow site from holding up the whole page.
async function checkStatus(url: string): Promise<"up" | "down"> {
  const tryOnce = async (method: "HEAD" | "GET") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        cache: "no-store",
        redirect: "follow",
      });
      return res.status < 500;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return (await tryOnce("HEAD")) ? "up" : (await tryOnce("GET")) ? "up" : "down";
  } catch {
    try {
      return (await tryOnce("GET")) ? "up" : "down";
    } catch {
      return "down";
    }
  }
}

function StatusDot({ status }: { status: "up" | "down" | "none" }) {
  if (status === "none") return null;
  const cls =
    status === "up"
      ? "bg-emerald-500"
      : "bg-red-500";
  const label = status === "up" ? "Online" : "Offline";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      <span className={`h-2 w-2 rounded-full ${cls}`} aria-hidden />
      {label}
    </span>
  );
}

function HubCardLink({ link, status }: { link: HubLink; status: "up" | "down" | "none" }) {
  const placeholder = link.url === "#";
  const cardInner = (
    <Card
      className={`h-full transition ${
        placeholder
          ? "opacity-60"
          : "hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700"
      }`}
    >
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between">
          <span className="text-2xl" aria-hidden>
            {link.emoji}
          </span>
          {!link.internal && !placeholder && (
            <ExternalLink className="h-4 w-4 text-zinc-400" aria-hidden />
          )}
        </div>
        <div className="font-medium">{link.name}</div>
        <p className="text-xs text-zinc-500">{link.description}</p>
        <div className="mt-auto pt-1">
          {placeholder ? (
            <span className="text-xs text-amber-600">Add link in hub/links.ts</span>
          ) : (
            <StatusDot status={status} />
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (placeholder) return <div>{cardInner}</div>;

  if (link.internal) {
    return (
      <Link href={link.url} className="block">
        {cardInner}
      </Link>
    );
  }

  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="block">
      {cardInner}
    </a>
  );
}

export default async function HubPage() {
  // Run all health checks in parallel; non-checked links resolve to "none".
  const statuses = await Promise.all(
    HUB_LINKS.map(async (l) => {
      if (!l.check || l.url === "#") return [l.key, "none"] as const;
      return [l.key, await checkStatus(l.url)] as const;
    })
  );
  const statusMap = new Map(statuses);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Command Center</h1>
        <p className="text-sm text-zinc-500">
          Every Xeltrix tool and channel, one click away.
        </p>
      </div>

      {HUB_CATEGORIES.map((category) => {
        const items = HUB_LINKS.filter((l) => l.category === category);
        if (items.length === 0) return null;
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((link) => (
                  <HubCardLink
                    key={link.key}
                    link={link}
                    status={(statusMap.get(link.key) ?? "none") as "up" | "down" | "none"}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
