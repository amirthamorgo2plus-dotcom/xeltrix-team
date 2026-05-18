"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { visibleNavItems } from "./nav-items";

export function MobileNav({ role }: { role?: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = visibleNavItems(role);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="fixed left-0 top-0 flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-950 p-4 text-zinc-300 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 text-sm font-bold text-zinc-900">
                  X
                </span>
                <span className="text-base font-semibold text-zinc-50">Xeltrix Team</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                      active
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-emerald-400" />
                    )}
                    <Icon
                      className={`h-4 w-4 ${
                        active ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-200"
                      }`}
                    />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
