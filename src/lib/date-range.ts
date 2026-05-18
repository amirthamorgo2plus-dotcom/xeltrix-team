// India fiscal year: Apr 1 → Mar 31

export type RangeKey =
  | "all"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_fy"
  | "last_fy"
  | "this_cy"
  | string; // arbitrary "yyyy-mm" for custom

export type RangeBounds = {
  key: string;
  start: string | null; // yyyy-mm-dd or null = unbounded
  end: string | null;
  label: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function indianFyStart(d: Date) {
  // FY starts April 1; if current month < April, the current FY started Apr last year
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(y, 3, 1); // Apr 1
}

export function resolveRange(key: string | undefined, now = new Date()): RangeBounds {
  const k = key && key.length > 0 ? key : "this_month";

  if (k === "all") return { key: "all", start: null, end: null, label: "All time" };

  if (k === "this_month") {
    const s = startOfMonth(now), e = endOfMonth(now);
    return {
      key: k,
      start: iso(s),
      end: iso(e),
      label: now.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    };
  }

  if (k === "last_month") {
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      key: k,
      start: iso(startOfMonth(ref)),
      end: iso(endOfMonth(ref)),
      label: ref.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    };
  }

  if (k === "this_quarter") {
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
    return {
      key: k,
      start: iso(qStart),
      end: iso(qEnd),
      label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
    };
  }

  if (k === "this_fy") {
    const s = indianFyStart(now);
    const e = new Date(s.getFullYear() + 1, 2, 31);
    return {
      key: k,
      start: iso(s),
      end: iso(e),
      label: `FY ${s.getFullYear()}–${String(s.getFullYear() + 1).slice(-2)}`,
    };
  }

  if (k === "last_fy") {
    const cur = indianFyStart(now);
    const s = new Date(cur.getFullYear() - 1, 3, 1);
    const e = new Date(cur.getFullYear(), 2, 31);
    return {
      key: k,
      start: iso(s),
      end: iso(e),
      label: `FY ${s.getFullYear()}–${String(s.getFullYear() + 1).slice(-2)}`,
    };
  }

  if (k === "this_cy") {
    const y = now.getFullYear();
    return {
      key: k,
      start: `${y}-01-01`,
      end: `${y}-12-31`,
      label: `Calendar ${y}`,
    };
  }

  // Custom "yyyy-mm" format
  const m = /^(\d{4})-(\d{2})$/.exec(k);
  if (m) {
    const ref = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return {
      key: k,
      start: iso(startOfMonth(ref)),
      end: iso(endOfMonth(ref)),
      label: ref.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    };
  }

  // Fallback
  return resolveRange("this_month", now);
}

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "this_fy", label: "This FY" },
  { key: "last_fy", label: "Last FY" },
  { key: "this_cy", label: "Calendar yr" },
  { key: "all", label: "All time" },
];
