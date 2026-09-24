"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { MapPin, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkIn, quickAddLead } from "./actions";
import { fill, type Dict } from "./i18n";

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
  t,
}: {
  leads: Lead[];
  workHours: { start: number; end: number };
  t: Dict;
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

  // Local list of leads (can grow when a new customer is added inline)
  const [leadList, setLeadList] = useState<Lead[]>(leads);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const [denied, setDenied] = useState(false);

  function requestLocation() {
    setPosError(null);
    setDenied(false);
    setGettingPos(true);
    if (!navigator.geolocation) {
      setPosError(t.geolocationUnsupported);
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
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        if (e.code === 1) {
          setDenied(true);
          setPosError(null);
        } else if (e.code === 3) {
          setPosError(t.locationTimedOut);
        } else {
          setPosError(t.locationFailed);
        }
        setGettingPos(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  // Is this an iPhone/iPad? Permission steps differ from Android.
  const isApple =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent);

  // Sort leads by distance from current GPS, then alphabetically
  const sortedLeads = useMemo(() => {
    const filtered = leadList.filter((l) =>
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
  }, [leadList, pos, search]);

  async function handleAddNewCustomer() {
    if (!newName.trim()) {
      setActionError(t.customerNameIsRequired);
      return;
    }
    setAdding(true);
    setActionError(null);
    try {
      const fd = new FormData();
      fd.set("name", newName.trim());
      if (newPhone.trim()) fd.set("phone", newPhone.trim());
      if (pos) {
        fd.set("lat", String(pos.lat));
        fd.set("lng", String(pos.lng));
      }
      const res = await quickAddLead(fd);
      // Add to local list with current pos so smart-sort still works
      const newLead: Lead = {
        id: res.id,
        name: newName.trim(),
        latitude: pos?.lat ?? null,
        longitude: pos?.lng ?? null,
      };
      setLeadList((prev) => [newLead, ...prev]);
      setLeadId(res.id);
      setNewName("");
      setNewPhone("");
      setShowNewForm(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add customer.");
    } finally {
      setAdding(false);
    }
  }

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
        setActionError(e instanceof Error ? e.message : t.checkInFailed);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.checkInTitle}</CardTitle>
        <div className="mt-1 text-xs text-zinc-500">
          {fill(t.workWindow, {
            start: workHours.start,
            end: workHours.end - 12,
          })}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!showForm && (
          <Button onClick={requestLocation} disabled={gettingPos}>
            {gettingPos ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t.gettingLocation}
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4" /> {t.checkInGetLocation}
              </>
            )}
          </Button>
        )}
        {posError && (
          <div className="text-xs text-red-600">
            {fill(t.locationPrefix, { message: posError })}
          </div>
        )}

        {denied && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-300/60 bg-amber-50/60 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              {t.permissionOff}
            </p>
            {isApple ? (
              <ol className="list-decimal pl-4 text-zinc-600 dark:text-zinc-400">
                <li>{t.iosStep1}</li>
                <li>{t.iosStep2}</li>
                <li>{t.iosStep3}</li>
                <li>{t.iosStep4}</li>
              </ol>
            ) : (
              <ol className="list-decimal pl-4 text-zinc-600 dark:text-zinc-400">
                <li>{t.androidStep1}</li>
                <li>{t.androidStep2}</li>
                <li>{t.androidStep3}</li>
                <li>{t.androidStep4}</li>
              </ol>
            )}
            <div>
              <Button size="sm" onClick={requestLocation} disabled={gettingPos}>
                {gettingPos ? t.retrying : t.retryLocation}
              </Button>
            </div>
          </div>
        )}

        {showForm && pos && (
          <div className="flex flex-col gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="text-xs text-zinc-500">
              {fill(t.locationLocked, {
                lat: pos.lat.toFixed(5),
                lng: pos.lng.toFixed(5),
              })}
            </div>

            <div>
              <Label>{t.customerLabel}</Label>
              <div className="mt-1 flex items-center gap-2">
                <Search className="h-4 w-4 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.searchCustomer}
                />
              </div>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowNewForm((v) => !v)}
                  className="flex w-full items-center gap-2 border-b border-zinc-200 bg-emerald-50/50 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-100/50 dark:border-zinc-800 dark:bg-emerald-950/20 dark:text-emerald-300"
                >
                  <UserPlus className="h-4 w-4" />
                  {t.addNewCustomer}
                </button>
                {showNewForm && (
                  <div className="flex flex-col gap-2 border-b border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t.customerNameRequired}
                      autoFocus
                    />
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder={t.phoneOptional}
                      type="tel"
                    />
                    <div className="text-[10px] text-zinc-500">
                      {t.quickAddHint}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={adding || !newName.trim()}
                        onClick={handleAddNewCustomer}
                      >
                        {adding ? t.saving : t.saveCustomer}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={adding}
                        onClick={() => {
                          setShowNewForm(false);
                          setNewName("");
                          setNewPhone("");
                        }}
                      >
                        {t.cancel}
                      </Button>
                    </div>
                  </div>
                )}
                <label className="flex cursor-pointer items-center gap-2 border-b border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                  <input
                    type="radio"
                    name="lead"
                    value=""
                    checked={leadId === ""}
                    onChange={() => setLeadId("")}
                  />
                  <span className="text-zinc-500">{t.noCustomer}</span>
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
                    {t.noMatchingCustomer}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>{t.notesOptional}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.purposeOfVisit}
                rows={2}
              />
            </div>

            {actionError && (
              <div className="text-xs text-red-600">{actionError}</div>
            )}

            <div className="flex gap-2">
              <Button disabled={pending} onClick={handleSubmit}>
                {pending ? t.saving : t.confirmCheckIn}
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setShowForm(false);
                  setPos(null);
                }}
              >
                {t.cancel}
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
