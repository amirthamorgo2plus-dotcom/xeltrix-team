"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleNavItems } from "./nav-items";

export function Sidebar({ role }: { role?: string | null }) {
  const items = visibleNavItems(role);
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4 text-zinc-300 md:flex">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 text-base font-bold text-zinc-900 shadow-lg shadow-emerald-500/20"
          aria-hidden
        >
          X
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold text-zinc-50">Xeltrix Team</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            ops · sales · cash
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              }`}
            >
              {active && (
                <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-emerald-400" />
              )}
              <Icon
                className={`h-4 w-4 transition-colors ${
                  active ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-200"
                }`}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-zinc-800 pt-3 text-[10px] uppercase tracking-wider text-zinc-600">
        v1 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
