"use client";

import dynamic from "next/dynamic";

// Leaflet uses window — must only load on the client.
export const VisitMap = dynamic(() => import("./visit-map-impl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
      Loading map…
    </div>
  ),
});
