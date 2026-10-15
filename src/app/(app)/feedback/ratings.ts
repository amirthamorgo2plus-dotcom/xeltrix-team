/**
 * The 1-5 scale, named.
 *
 * A bare number means different things to different people, so each point
 * has a word. Shared between the form and the list so a 2 never reads as
 * "Unhappy" in one place and "Poor" in another.
 */
export const RATINGS = [
  { value: 1, label: "Angry",    activeBorder: "border-red-500",     activeBg: "bg-red-500/10",     activeText: "text-red-400",     dot: "bg-red-500" },
  { value: 2, label: "Unhappy",  activeBorder: "border-orange-500",  activeBg: "bg-orange-500/10",  activeText: "text-orange-400",  dot: "bg-orange-500" },
  { value: 3, label: "OK",       activeBorder: "border-amber-500",   activeBg: "bg-amber-500/10",   activeText: "text-amber-400",   dot: "bg-amber-500" },
  { value: 4, label: "Happy",    activeBorder: "border-lime-500",    activeBg: "bg-lime-500/10",    activeText: "text-lime-400",    dot: "bg-lime-500" },
  { value: 5, label: "Delighted",activeBorder: "border-emerald-500", activeBg: "bg-emerald-500/10", activeText: "text-emerald-400", dot: "bg-emerald-500" },
] as const;

export function ratingLabel(v: number): string {
  return RATINGS.find((r) => r.value === v)?.label ?? String(v);
}

export function ratingTone(v: number): "success" | "warning" | "danger" {
  return v >= 4 ? "success" : v === 3 ? "warning" : "danger";
}
