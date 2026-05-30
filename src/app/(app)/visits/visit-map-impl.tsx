"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
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

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  subtitle?: string;
  color?: string;
  paired?: { lat: number; lng: number } | null; // checkout location
};

export default function VisitMapImpl({
  pins,
  height = 360,
}: {
  pins: MapPin[];
  height?: number;
}) {
  useEffect(() => {
    fixDefaultIcon();
  }, []);

  // Center: average of pin coords, or a sensible India fallback (Coimbatore)
  const center: [number, number] =
    pins.length > 0
      ? [
          pins.reduce((s, p) => s + p.lat, 0) / pins.length,
          pins.reduce((s, p) => s + p.lng, 0) / pins.length,
        ]
      : [11.0168, 76.9558];

  return (
    <div
      className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={pins.length > 0 ? 12 : 10}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]}>
            <Popup>
              <div className="text-sm">
                <div className="font-medium">{p.label}</div>
                {p.subtitle && (
                  <div className="text-xs text-zinc-500">{p.subtitle}</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {pins
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
