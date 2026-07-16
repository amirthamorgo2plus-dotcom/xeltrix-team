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
