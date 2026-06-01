"use client";

import { useState, useTransition } from "react";
import { MapPin, Check, X } from "lucide-react";
import { updateLeadLocation } from "./actions";

// Inline editor for a lead's exact coordinates. Paste "lat, lng" (Google Maps
// right-click → copy) or a full Google Maps URL. Shows a link to the pin when
// set, and whether it's a hand-placed ('manual') vs auto-geocoded location.
export function LocationCell({
  id,
  lat,
  lng,
  status,
}: {
  id: string;
  lat: number | null;
  lng: number | null;
  status: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    lat != null && lng != null ? `${lat}, ${lng}` : ""
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hasCoords = lat != null && lng != null;

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateLeadLocation(id, value);
      if (res.error) setErr(res.error);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {hasCoords ? (
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
            title={status === "manual" ? "Exact (hand-placed)" : "Approximate (auto-geocoded)"}
          >
            <MapPin className="h-3.5 w-3.5" />
            {status === "manual" ? "Exact" : "Approx"}
          </a>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-zinc-500 underline-offset-2 hover:underline"
        >
          {hasCoords ? "edit" : "set"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="12.97, 77.59 or Maps link"
          className="h-8 w-44 rounded-md border border-zinc-300 bg-transparent px-2 text-xs dark:border-zinc-700"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-emerald-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          title="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setErr(null);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
      <span className="text-[11px] text-zinc-400">
        Tip: in Google Maps, right-click the spot → click the coordinates to
        copy → paste here. Leave blank to clear.
      </span>
    </div>
  );
}
