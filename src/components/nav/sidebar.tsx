import Link from "next/link";
import { visibleNavItems } from "./nav-items";

export function Sidebar({ role }: { role?: string | null }) {
  const items = visibleNavItems(role);
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 px-2 text-lg font-semibold">Xeltrix Team</div>
      <nav className="flex flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
