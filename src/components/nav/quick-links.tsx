import Link from "next/link";
import { visibleNavItems } from "@/components/nav/nav-items";

/**
 * Icon shortcuts to the pages people open every day.
 *
 * Driven from the same NAV_ITEMS the sidebar uses, so a member never sees a
 * shortcut to a page they cannot open, and a page added to the nav shows up
 * here without being listed twice.
 *
 * On a phone the sidebar is behind a hamburger, which is two taps and a scroll
 * away from Attendance. These are one tap.
 */

// The daily ones, in the order a field member needs them. Anything not listed
// stays in the sidebar; a launcher that shows everything is just the nav again.
const QUICK = [
  "/attendance",
  "/visits",
  "/tasks",
  "/production",
  "/leads",
  "/deep-cleaning",
  "/collections",
  "/targets",
];

export function QuickLinks({
  role,
  attendanceOnly = false,
}: {
  role: string | null | undefined;
  attendanceOnly?: boolean;
}) {
  const allowed = visibleNavItems(role, attendanceOnly);
  const byHref = new Map(allowed.map((i) => [i.href, i]));
  const items = QUICK.map((h) => byHref.get(h)).filter(
    (i): i is NonNullable<typeof i> => Boolean(i)
  );

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white p-2 text-center transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
        >
          <Icon className="h-5 w-5 shrink-0 text-[#b5c76a]" aria-hidden />
          {/* Wraps rather than truncates: "Deep Cleaning" on two lines is
              readable, "Deep Cle…" is not. */}
          <span className="text-[11px] leading-tight text-zinc-600 dark:text-zinc-300">
            {label}
          </span>
        </Link>
      ))}
    </div>
  );
}
