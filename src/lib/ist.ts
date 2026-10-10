import { TZDate } from "@date-fns/tz";

// Xeltrix staff and all business data are India-based, but server components
// render on Vercel (UTC) — so date-fns format() would print UTC, i.e. 5:30
// behind. Wrap any timestamptz value with ist() before format() so it always
// renders in IST, identically on the server and in the browser (no drift,
// regardless of the user's device timezone).
//
//   format(ist(visit.check_in_at), "HH:mm")   // → IST wall-clock
export const IST = "Asia/Kolkata";

// Normalise to a Date first so the TZDate(date, timeZone) overload resolves.
export const ist = (v: string | number | Date) => new TZDate(new Date(v), IST);

// A <input type="datetime-local"> value has no timezone ("2026-10-11T18:00"),
// so `new Date(v)` reads it in the SERVER's zone — UTC on Vercel — and 18:00
// typed by someone in Chennai is stored as 23:30 IST. Staff and data are both
// India-based, so the typed value is always IST wall-clock; say so explicitly.
export function istInputToIso(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  const withSeconds = s.length === 16 ? `${s}:00` : s; // yyyy-MM-ddTHH:mm
  const d = new Date(`${withSeconds}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The inverse: an instant rendered as an IST wall-clock datetime-local value. */
export function isoToIstInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = ist(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}
