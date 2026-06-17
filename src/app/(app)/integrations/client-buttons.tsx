"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  clearSyncedData,
  disconnectZoho,
  listZohoOrgs,
  setZohoOrg,
  triggerSync,
} from "./actions";

export function SyncNowButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [since, setSince] = useState<string>(() => {
    // Default to 35 days ago so a normal sync always covers the full
    // current month (and recent edits) — not just today.
    const d = new Date();
    d.setDate(d.getDate() - 35);
    return d.toISOString().slice(0, 10);
  });
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Since
        <input
          type="date"
          value={since}
          disabled={pending}
          onChange={(e) => setSince(e.target.value)}
          className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
        />
      </label>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await triggerSync(since);
            if (r?.ok) {
              const summary = `Synced ${r.customers ?? 0} customers, ${r.items ?? 0} items, ${r.invoices ?? 0} invoices, ${r.quotes ?? 0} quotes, ${(r as { expenses?: number }).expenses ?? 0} expenses`;
              const warnings = (r as { warnings?: string[] }).warnings ?? [];
              setMsg(warnings.length ? `${summary} — ${warnings.join("; ")}` : summary);
              router.refresh();
            } else {
              setMsg(r?.error ? `Error: ${r.error}` : "Sync failed");
            }
          })
        }
      >
        {pending ? "Syncing..." : "Sync now"}
      </Button>
      <div className="flex flex-col text-xs">
        <span className="text-zinc-500">
          Default: last 35 days (covers this month). For full history, set to 2024-01-01 and click a few times.
        </span>
        {msg && <span className="text-zinc-600 dark:text-zinc-400">{msg}</span>}
      </div>
    </div>
  );
}

// Pick which Zoho organization this connection points at (a Zoho login can
// have several). Loads the list on demand, then saves the chosen org.
export function ZohoOrgPicker({ current }: { current?: string }) {
  const [pending, start] = useTransition();
  const [orgs, setOrgs] = useState<{ id: string; name: string }[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      {!orgs ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await listZohoOrgs();
              if (r.ok && r.orgs) {
                setOrgs(r.orgs);
                if (r.orgs.length === 0) setMsg("No organizations found for this Zoho login.");
              } else setMsg(r.error ?? "Failed to load organizations.");
            })
          }
        >
          {pending ? "Loading…" : "Change Zoho organization"}
        </Button>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Zoho organization
          <select
            defaultValue={current}
            disabled={pending}
            onChange={(e) =>
              start(async () => {
                const r = await setZohoOrg(e.target.value);
                if (r.error) setMsg(r.error);
                else {
                  setMsg("Saved. Clear old data (if any), then click Sync now.");
                  router.refresh();
                }
              })
            }
            className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.id})
              </option>
            ))}
          </select>
        </label>
      )}
      {msg && <span className="text-xs text-zinc-600 dark:text-zinc-400">{msg}</span>}
    </div>
  );
}

// Delete this org's Zoho-sourced records (wrong-org cleanup).
export function ClearSyncedDataButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        className="text-red-600"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              "Delete THIS organization's Zoho-synced data (leads, opportunities, quotes, expenses, items)?\n\nUse this if the wrong Zoho organization was synced in. It does not touch other orgs. Cannot be undone."
            )
          )
            return;
          start(async () => {
            const r = await clearSyncedData();
            if (r.error) setMsg(r.error);
            else {
              setMsg("Cleared. Select the correct organization, then Sync now.");
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Clearing…" : "Clear synced data"}
      </Button>
      {msg && <span className="text-xs text-zinc-600 dark:text-zinc-400">{msg}</span>}
    </div>
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
