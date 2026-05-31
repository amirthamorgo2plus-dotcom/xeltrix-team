"use client";

import { useEffect, useState } from "react";

// Two reference clocks for the header so the team can see IST and Fiji time
// at a glance and stop calling each other at odd hours. Fiji (UTC+12/+13) is
// usually several hours ahead of IST (UTC+5:30) and often already on the next
// calendar day — hence we show the weekday too.
const ZONES = [
  { label: "IST", tz: "Asia/Kolkata" },
  { label: "Fiji", tz: "Pacific/Fiji" },
] as const;

function fmtTime(tz: string, date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function fmtDay(tz: string, date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
  }).format(date);
}

// UTC offset (minutes) of a time zone for a given instant — DST-aware, derived
// from Intl so it stays correct even if Fiji changes its rules.
function offsetMinutes(tz: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour % 24,
    map.minute,
    map.second,
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

function fmtDiff(minutes: number) {
  const sign = minutes >= 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m ? String(m).padStart(2, "0") : ""}`;
}

export function WorldClocks() {
  // null until mounted so the server render and first client render match
  // (a live time would otherwise trigger a hydration mismatch).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  const diff =
    now && offsetMinutes("Pacific/Fiji", now) - offsetMinutes("Asia/Kolkata", now);

  return (
    <div
      className="flex items-stretch gap-1 sm:gap-1.5"
      title={
        now
          ? `Fiji is ${fmtDiff(diff as number)} relative to IST`
          : "IST and Fiji time"
      }
    >
      {ZONES.map(({ label, tz }) => (
        <div
          key={tz}
          className="flex flex-col items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 leading-none sm:px-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </span>
          <span className="font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-100">
            {now ? (
              <>
                <span className="mr-1 hidden text-zinc-400 sm:inline">{fmtDay(tz, now)}</span>
                {fmtTime(tz, now)}
              </>
            ) : (
              "--:--"
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
