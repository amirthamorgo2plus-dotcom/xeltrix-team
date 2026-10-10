"use client";

import { useRouter } from "next/navigation";

/**
 * A table row that opens its task.
 *
 * The whole row is the target because that is what a scanning view wants, but
 * the title cell still holds a real link so middle-click, "open in new tab"
 * and keyboard navigation keep working. The row carries no inline controls —
 * editing lives on the task's own page, which also avoids a click on a select
 * navigating away underneath it.
 */
export function TaskRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
    >
      {children}
    </tr>
  );
}
