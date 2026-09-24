"use client";

import { useState, useTransition } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkOut } from "./actions";
import type { Dict } from "./i18n";

export function CheckOutButton({
  visitId,
  t,
}: {
  visitId: string;
  t: Dict;
}) {
  const [showForm, setShowForm] = useState(false);
  const [gettingPos, setGettingPos] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function requestLocation() {
    setPosError(null);
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
        setPosError(e.message);
        setGettingPos(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  function handleSubmit() {
    if (!pos) return;
    const fd = new FormData();
    fd.set("lat", String(pos.lat));
    fd.set("lng", String(pos.lng));
    fd.set("notes", notes);
    setActionError(null);
    start(async () => {
      try {
        await checkOut(visitId, fd);
        setShowForm(false);
        setNotes("");
        setPos(null);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : t.checkOutFailed);
      }
    });
  }

  if (!showForm) {
    return (
      <div className="flex flex-col gap-1">
        <Button size="sm" onClick={requestLocation} disabled={gettingPos}>
          {gettingPos ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> {t.gettingLocation}
            </>
          ) : (
            <>
              <MapPin className="h-3 w-3" /> {t.checkOut}
            </>
          )}
        </Button>
        {posError && <span className="text-xs text-red-600">{posError}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t.visitNotesOptional}
        rows={2}
        className="text-xs"
      />
      {actionError && <span className="text-xs text-red-600">{actionError}</span>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={handleSubmit}>
          {pending ? t.saving : t.confirmCheckOut}
        </Button>
        <Button
          size="sm"
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
  );
}
