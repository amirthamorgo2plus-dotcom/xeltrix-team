/**
 * Working days, and the ones nobody marked.
 *
 * An attendance row exists only when someone marks it, so a working day with
 * no row is ambiguous: the person may not have come in, or nobody may have
 * recorded it. Those are reported separately from `absent` rather than folded
 * into it — a missing record should not read as an accusation.
 *
 * The window matters more than the rule. Counting back to someone's
 * employment start invents months of absence for the period before the app
 * existed, so it starts at the LATER of the recorded employment start and the
 * person's first attendance row: before either, silence means nobody was
 * tracking, not that anyone was away. It never runs past today, because a
 * working day that has not happened yet is not a missing record.
 */

/** Off = Sunday, 1st Saturday, or a listed holiday closed to work. */
export function isOffDay(iso: string, closedDates: ReadonlySet<string>): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  if (dow === 0) return true;
  if (dow === 6 && d.getUTCDate() <= 7) return true; // 1st Saturday
  return closedDates.has(iso);
}

/** Every working day in [startIso, endIso], inclusive. Empty if start > end. */
export function workingDaysBetween(
  startIso: string,
  endIso: string,
  closedDates: ReadonlySet<string>
): string[] {
  if (startIso > endIso) return [];
  const out: string[] = [];
  const d = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  for (; d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (!isOffDay(iso, closedDates)) out.push(iso);
  }
  return out;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * The date from which this person's records can be trusted to be complete:
 * the later of their employment start and their first ever attendance row.
 * Null when neither is known — nothing can be inferred for them at all.
 */
export function trackedFrom(
  employmentStart: string | null | undefined,
  firstRecord: string | null | undefined
): string | null {
  const a = employmentStart || null;
  const b = firstRecord || null;
  if (a && b) return a > b ? a : b;
  return a ?? b;
}

/**
 * Working days inside [windowStart, windowEnd] with no attendance row, for one
 * person. Clamped to their tracked period and to today.
 */
export function unmarkedDays(args: {
  windowStart: string;
  windowEnd: string;
  trackedFrom: string | null;
  markedDates: ReadonlySet<string>;
  closedDates: ReadonlySet<string>;
  today?: string;
}): string[] {
  const { windowStart, windowEnd, markedDates, closedDates } = args;
  if (!args.trackedFrom) return [];
  const today = args.today ?? todayIso();
  const start = args.trackedFrom > windowStart ? args.trackedFrom : windowStart;
  const end = windowEnd < today ? windowEnd : today;
  return workingDaysBetween(start, end, closedDates).filter((d) => !markedDates.has(d));
}
