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
// Twelve, so the grid fills three even rows of four on a phone rather than
// leaving a single tile stranded on its own. Roughly in the order a field
// member needs them: record something, then look something up.
const QUICK = [
  // First because it is the one tile reached every day from a desk, where
  // landing on a launcher would otherwise cost a click each morning.
  "/dashboard",
  "/attendance",
  "/visits",
  "/tasks",
  "/production",
  "/leads",
  "/deep-cleaning",
  "/complaints",
  "/payment-qr",
  "/collections",
  "/targets",
  "/calendar",
];

export function QuickLinks({
  role,
  attendanceOnly = false,
}: {
  role: string | null | undefined;
  attendanceOnly?: boolean;
}) {
  // Children as well as top-level items: Complaints and Calendar live under
  // Customers and Attendance in the sidebar, but on a launcher they are
  // destinations in their own right. visibleNavItems has already dropped
  // anything this role cannot open, at both levels.
  const allowed = visibleNavItems(role, attendanceOnly);
  const byHref = new Map(
    allowed.flatMap((i) => [i, ...(i.children ?? [])]).map((i) => [i.href, i])
  );
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
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 text-center transition-colors active:bg-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:active:bg-zinc-800 dark:hover:bg-zinc-800/60"
        >
          {/* A tinted rounded square reads as an app icon at a glance, which
              is the point: people recognise the shape before the word. */}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b5c76a]/10">
            <Icon className="h-5 w-5 text-[#b5c76a]" aria-hidden />
          </span>
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
