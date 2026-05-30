"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkIn } from "./actions";

type Lead = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

// Haversine distance in km between two points
function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function CheckInButton({
  leads,
  workHours,
}: {
  leads: Lead[];
  workHours: { start: number; end: number };
}) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const [gettingPos, setGettingPos] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [leadId, setLeadId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  function requestLocation() {
    setPosError(null);
    setGettingPos(true);
    if (!navigator.geolocation) {
      setPosError("Geolocation not supported in this browser.");
      setGettingPos(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setShowForm(true);
        setGettingPos(false);
      },
      (e) => {
        setPosError(e.message);
        setGettingPos(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  // Sort leads by distance from current GPS, then alphabetically
  const sortedLeads = useMemo(() => {
    const filtered = leads.filter((l) =>
      l.name.toLowerCase().includes(search.toLowerCase().trim())
    );
    if (!pos) return filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered.sort((a, b) => {
      const aHas = a.latitude != null && a.longitude != null;
      const bHas = b.latitude != null && b.longitude != null;
      if (aHas && bHas) {
        const da = distanceKm(pos.lat, pos.lng, a.latitude!, a.longitude!);
        const db = distanceKm(pos.lat, pos.lng, b.latitude!, b.longitude!);
        return da - db;
      }
      if (aHas) return -1;
      if (bHas) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [leads, pos, search]);

  function distanceLabel(l: Lead) {
    if (!pos || l.latitude == null || l.longitude == null) return null;
    const d = distanceKm(pos.lat, pos.lng, l.latitude, l.longitude);
    if (d < 1) return `${Math.round(d * 1000)} m`;
    return `${d.toFixed(1)} km`;
  }

  function handleSubmit() {
    if (!pos) return;
    const fd = new FormData();
    fd.set("lat", String(pos.lat));
    fd.set("lng", String(pos.lng));
    fd.set("lead_id", leadId);
    fd.set("notes", notes);
    setActionError(null);
    start(async () => {
      try {
        await checkIn(fd);
        setShowForm(false);
        setLeadId("");
        setNotes("");
        setSearch("");
        setPos(null);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Check-in failed.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check in to a visit</CardTitle>
        <div className="mt-1 text-xs text-zinc-500">
          Work-hours window: {workHours.start} AM – {workHours.end - 12} PM IST
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!showForm && (
          <Button onClick={requestLocation} disabled={gettingPos}>
            {gettingPos ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Getting location…
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" /> Check in (get location)
              </>
            )}
          </Button>
        )}
        {posError && (
          <div className="text-xs text-red-600">Location: {posError}</div>
        )}

        {showForm && pos && (
          <div className="flex flex-col gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="text-xs text-zinc-500">
              📍 Location locked: {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
            </div>

            <div>
              <Label>Customer (optional, closest first)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Search className="h-4 w-4 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer…"
                />
              </div>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                <label className="flex cursor-pointer items-center gap-2 border-b border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                  <input
                    type="radio"
                    name="lead"
                    value=""
                    checked={leadId === ""}
                    onChange={() => setLeadId("")}
                  />
                  <span className="text-zinc-500">(no customer)</span>
                </label>
                {sortedLeads.slice(0, 50).map((l) => (
                  <label
                    key={l.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-zinc-200 px-3 py-2 text-sm last:border-b-0 dark:border-zinc-800"
                  >
                    <input
                      type="radio"
                      name="lead"
                      value={l.id}
                      checked={leadId === l.id}
                      onChange={() => setLeadId(l.id)}
                    />
                    <span className="flex-1 truncate">{l.name}</span>
                    {distanceLabel(l) && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">
                        {distanceLabel(l)}
                      </span>
                    )}
                  </label>
                ))}
                {sortedLeads.length === 0 && (
                  <div className="px-3 py-2 text-sm text-zinc-500">
                    No matching customer
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Purpose of visit…"
                rows={2}
              />
            </div>

            {actionError && (
              <div className="text-xs text-red-600">{actionError}</div>
            )}

            <div className="flex gap-2">
              <Button disabled={pending} onClick={handleSubmit}>
                {pending ? "Saving…" : "Confirm check-in"}
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setShowForm(false);
                  setPos(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Renders nothing on its own; useEffect-based watcher so we can show a soft
// hint about location permission state (kept simple for now).
export function _LocationHint() {
  const [status, setStatus] = useState<string>("unknown");
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((p) => setStatus(p.state));
  }, []);
  if (status === "denied")
    return (
      <p className="text-xs text-red-600">
        Location permission is denied. Enable it in browser settings.
      </p>
    );
  return null;
}
