"use client";

import { useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Lets a user verify location works (especially iPhones) without doing a real
// check-in. Mirrors the check-in permission handling so the steps match.
export function LocationTest() {
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
      setError("Geolocation isn't supported in this browser.");
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
          setError("Timed out. Move near a window or outside and try again.");
        } else {
          setError("Couldn't get location. Make sure GPS/Location is on, then retry.");
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
            <Loader2 className="h-4 w-4 animate-spin" /> Testing…
          </>
        ) : (
          <>
            <Crosshair className="h-4 w-4" /> Test my location
          </>
        )}
      </Button>

      {ok && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-700 dark:text-emerald-300">
          ✅ Location works — {ok.lat.toFixed(5)}, {ok.lng.toFixed(5)} (±{ok.acc} m). You can
          check in.
        </div>
      )}

      {error && <div className="text-xs text-red-600">{error}</div>}

      {denied && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300/60 bg-amber-50/60 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Location permission is off — turn it on, then test again.
          </p>
          {isApple ? (
            <ol className="list-decimal pl-4 text-zinc-600 dark:text-zinc-400">
              <li>
                iPhone <strong>Settings → Privacy &amp; Security → Location Services</strong> →
                turn ON.
              </li>
              <li>
                Scroll to <strong>Safari Websites</strong> → set to <strong>While Using</strong>.
              </li>
              <li>
                In Safari on this page, tap <strong>aA</strong> in the address bar →{" "}
                <strong>Website Settings → Location → Allow</strong>.
              </li>
              <li>Come back and tap Test again.</li>
            </ol>
          ) : (
            <ol className="list-decimal pl-4 text-zinc-600 dark:text-zinc-400">
              <li>
                Tap the <strong>lock / ⓘ icon</strong> in the address bar.
              </li>
              <li>
                Set <strong>Location</strong> to <strong>Allow</strong>.
              </li>
              <li>Make sure the phone&apos;s GPS/Location is on.</li>
              <li>Tap Test again.</li>
            </ol>
          )}
          <div>
            <Button size="sm" onClick={test} disabled={busy}>
              {busy ? "Testing…" : "Test again"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
