"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icons reference asset URLs that don't resolve under
// bundlers; use inline CDN URLs so markers render reliably.
function fixDefaultIcon() {
  // Cast to a shape that exposes the protected _getIconUrl Leaflet relies on.
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })
    ._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Numbered pin for route stops (1, 2, 3 … in visit order).
function numberedIcon(n: number) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#2563eb;color:#fff;width:24px;height:24px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45)">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

// Storefront pin for customers (geocoded addresses). Amber teardrop with a
// shop glyph so it reads clearly as "customer location" and is distinct from
// the blue numbered route stops and default visit markers.
const customerIcon = () =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;width:28px;height:36px">
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.3 0 0 6.1 0 13.6 0 23 14 36 14 36s14-13 14-22.4C28 6.1 21.7 0 14 0z" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
      </svg>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;top:5px;left:6px">
        <path d="M3 9l1.5-5h15L21 9"/>
        <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/>
        <path d="M3 9h18"/>
        <path d="M9 20v-6h6v6"/>
      </svg>
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -34],
  });

// Pans/zooms so every pin is on screen. Centring on the average coordinate at
// a fixed zoom breaks as soon as pins are spread out — customers run from
// Coimbatore to Chennai, so the average lands in open country with nothing
// visible. Fitting the bounds keeps the pins on screen at any spread.
function FitToPins({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  // Re-fit only when the set of coordinates actually changes.
  const key = pins.map((p) => `${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (pins.length === 0) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
    // A single pin produces a zero-area bounds; maxZoom stops Leaflet from
    // slamming to street level.
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    // `key` captures the coordinates; `pins`/`map` are stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return null;
}

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  subtitle?: string;
  color?: string;
  paired?: { lat: number; lng: number } | null; // checkout location
  order?: number; // 1-based sequence number → renders a numbered marker
  kind?: "visit" | "customer";
};

export default function VisitMapImpl({
  pins,
  routePath,
  height = 360,
}: {
  pins: MapPin[];
  routePath?: Array<[number, number]>;
  height?: number;
}) {
  useEffect(() => {
    fixDefaultIcon();
  }, []);

  const hasRoute = !!routePath && routePath.length >= 2;

  // Initial view only — FitToPins takes over as soon as there are pins.
  // Falls back to Coimbatore when the map is empty.
  const center: [number, number] = [11.0168, 76.9558];

  function iconFor(p: MapPin) {
    if (p.order != null) return numberedIcon(p.order);
    if (p.kind === "customer") return customerIcon();
    return undefined; // default Leaflet marker
  }

  return (
    <div
      className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <FitToPins pins={pins} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Sequence polyline connecting stops in visit order */}
        {hasRoute && (
          <Polyline
            positions={routePath!}
            pathOptions={{
              color: "#2563eb",
              weight: 3,
              opacity: 0.7,
              dashArray: "6 6",
            }}
          />
        )}

        {pins.map((p) => {
          const icon = iconFor(p);
          return (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              {...(icon ? { icon } : {})}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-medium">
                    {p.order != null ? `${p.order}. ` : ""}
                    {p.label}
                  </div>
                  {p.subtitle && (
                    <div className="text-xs text-zinc-500">{p.subtitle}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Per-visit check-in→check-out lines (only when not in route mode) */}
        {!hasRoute &&
          pins
            .filter((p) => p.paired)
            .map((p) => (
              <Polyline
                key={`line-${p.id}`}
                positions={[
                  [p.lat, p.lng],
                  [p.paired!.lat, p.paired!.lng],
                ]}
                pathOptions={{ color: "#10b981", weight: 2, opacity: 0.6 }}
              />
            ))}
      </MapContainer>
    </div>
  );
}
