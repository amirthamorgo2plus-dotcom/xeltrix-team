"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPinned, RotateCw } from "lucide-react";

// Admin control: geocodes a batch of customers (address → coordinates) via the
// /api/geocode-leads endpoint. Processes ~20 per click (rate-limited), so the
// admin clicks until "pending" reaches zero. A second button retries addresses
// that previously failed (useful after the geocoder gains a coarse fallback).
export function GeocodeCustomersButton({
  pending,
  failed = 0,
}: {
  pending: number;
  failed?: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(pending);
  const [failedLeft, setFailedLeft] = useState(failed);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(retry: boolean) {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/geocode-leads${retry ? "?retry=1" : ""}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Geocoding failed");
      setRemaining(data.remaining ?? 0);
      setFailedLeft(data.failedRemaining ?? 0);
      setMsg(
        `+${data.ok} located${data.failed ? `, ${data.failed} not found` : ""} · ${data.remaining} fresh, ${data.failedRemaining ?? 0} not-found left`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Geocoding failed");
    } finally {
      setRunning(false);
    }
  }

  if (remaining === 0 && failedLeft === 0 && !msg) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => run(false)}
          disabled={running}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 px-3 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <MapPinned className="h-3.5 w-3.5" />
          {running ? "Geocoding…" : `Geocode customers (${remaining})`}
        </button>
      )}
      {remaining === 0 && failedLeft > 0 && (
        <button
          type="button"
          onClick={() => run(true)}
          disabled={running}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 px-3 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <RotateCw className="h-3.5 w-3.5" />
          {running ? "Retrying…" : `Retry not-found (${failedLeft})`}
        </button>
      )}
      {msg && <span>{msg}</span>}
    </div>
  );
}
