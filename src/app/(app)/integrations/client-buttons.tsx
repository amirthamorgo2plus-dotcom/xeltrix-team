"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { disconnectZoho, triggerSync } from "./actions";

export function SyncNowButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-3">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await triggerSync();
            if (r?.ok) {
              const summary = `Synced ${r.customers ?? 0} customers, ${r.items ?? 0} items, ${r.invoices ?? 0} invoices, ${r.quotes ?? 0} quotes`;
              const warnings = (r as { warnings?: string[] }).warnings ?? [];
              setMsg(warnings.length ? `${summary} — ${warnings.join("; ")}` : summary);
            } else {
              setMsg(r?.error ? `Error: ${r.error}` : "Sync failed");
            }
          })
        }
      >
        {pending ? "Syncing..." : "Sync now"}
      </Button>
      {msg && <span className="text-xs text-zinc-600 dark:text-zinc-400">{msg}</span>}
    </span>
  );
}

export function DisconnectButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm("Disconnect Zoho Books? Existing synced records stay.")) return;
        start(() => disconnectZoho());
      }}
    >
      {pending ? "..." : "Disconnect"}
    </Button>
  );
}
