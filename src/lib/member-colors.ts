// One source of truth for per-employee colours so the same person looks the
// same on every page (tasks, report, …). Keyed by member id via a small stable
// hash — independent of list order. Full class strings so Tailwind keeps them.

export type MemberColor = { border: string; dot: string; ring: string };

export const MEMBER_COLORS: MemberColor[] = [
  { border: "border-l-rose-400", dot: "bg-rose-400", ring: "ring-rose-400" },
  { border: "border-l-amber-400", dot: "bg-amber-400", ring: "ring-amber-400" },
  { border: "border-l-emerald-400", dot: "bg-emerald-400", ring: "ring-emerald-400" },
  { border: "border-l-sky-400", dot: "bg-sky-400", ring: "ring-sky-400" },
  { border: "border-l-violet-400", dot: "bg-violet-400", ring: "ring-violet-400" },
  { border: "border-l-pink-400", dot: "bg-pink-400", ring: "ring-pink-400" },
  { border: "border-l-teal-400", dot: "bg-teal-400", ring: "ring-teal-400" },
  { border: "border-l-orange-400", dot: "bg-orange-400", ring: "ring-orange-400" },
  { border: "border-l-cyan-400", dot: "bg-cyan-400", ring: "ring-cyan-400" },
  { border: "border-l-lime-400", dot: "bg-lime-400", ring: "ring-lime-400" },
];

export const NO_COLOR: MemberColor = {
  border: "border-l-zinc-300 dark:border-l-zinc-700",
  dot: "bg-zinc-300",
  ring: "ring-zinc-300",
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function memberColor(id?: string | null): MemberColor {
  if (!id) return NO_COLOR;
  return MEMBER_COLORS[hash(id) % MEMBER_COLORS.length];
}
