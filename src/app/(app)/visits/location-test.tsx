"use client";

import { useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fill, type Dict } from "./i18n";

// Lets a user verify location works (especially iPhones) without doing a real
// check-in. Mirrors the check-in permission handling so the steps match.
export function LocationTest({ t }: { t: Dict }) {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const isApple =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

  function test() {
    setBusy(true);
    setOk(null);
    setError(null);
    setDenied(false);
    if (!navigator.geolocation) {
      setError(t.geolocationUnsupported);
      setBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOk({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc: Math.round(p.coords.accuracy),
        });
        setBusy(false);
      },
      (e) => {
        if (e.code === 1) {
          setDenied(true);
        } else if (e.code === 3) {
          setError(t.locationTimedOut);
        } else {
          setError(t.locationFailed);
        }
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={test} disabled={busy} className="w-fit">
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t.testing}
          </>
        ) : (
          <>
            <Crosshair className="h-4 w-4" /> {t.testMyLocation}
          </>
        )}
      </Button>

      {ok && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-700 dark:text-emerald-300">
          ✅ {t.locationWorks} — {ok.lat.toFixed(5)}, {ok.lng.toFixed(5)} (
          {fill(t.accuracyMeters, { n: ok.acc })})
        </div>
      )}

      {error && <div className="text-xs text-red-600">{error}</div>}

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
            <Button size="sm" onClick={test} disabled={busy}>
              {busy ? t.testing : t.testMyLocation}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
