"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPinned } from "lucide-react";

// Admin control: geocodes a batch of customers (address → coordinates) via the
// /api/geocode-leads endpoint. Processes ~20 per click (rate-limited), so the
// admin clicks until "pending" reaches zero.
export function GeocodeCustomersButton({ pending }: { pending: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(pending);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/geocode-leads", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Geocoding failed");
      setRemaining(data.remaining ?? 0);
      setMsg(
        `+${data.ok} located${data.failed ? `, ${data.failed} not found` : ""} · ${data.remaining} left`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Geocoding failed");
    } finally {
      setRunning(false);
    }
  }

  if (remaining === 0 && !msg) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <button
        type="button"
        onClick={run}
        disabled={running || remaining === 0}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 px-3 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        <MapPinned className="h-3.5 w-3.5" />
        {running
          ? "Geocoding…"
          : remaining > 0
            ? `Geocode customers (${remaining})`
            : "Customers geocoded"}
      </button>
      {msg && <span>{msg}</span>}
    </div>
  );
}
