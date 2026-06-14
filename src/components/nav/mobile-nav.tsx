"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, Globe } from "lucide-react";
import { visibleNavItems, type NavItem } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(href + "/");
}

function MobileRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const { href, label, icon: Icon, children } = item;
  const hasChildren = !!children && children.length > 0;
  const selfActive = isActive(pathname, href);
  const childActive =
    hasChildren && children!.some((c) => isActive(pathname, c.href));
  const [open, setOpen] = useState(selfActive || childActive);
  const expanded = open || childActive;

  return (
    <div>
      <div
        className={`group relative flex items-center rounded-md text-sm ${
          selfActive
            ? "bg-emerald-500/10 text-emerald-300"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
        }`}
      >
        {selfActive && (
          <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-emerald-400" />
        )}
        <Link href={href} className="flex flex-1 items-center gap-3 px-3 py-2">
          <Icon
            className={`h-4 w-4 ${
              selfActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-200"
            }`}
          />
          {label}
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            className="flex h-9 w-9 items-center justify-center text-zinc-500 hover:text-zinc-200"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {children!.map((c) => {
            const active = isActive(pathname, c.href);
            return (
              <Link
                key={c.href}
                href={c.href}
                className={`group relative flex items-center gap-3 rounded-md py-1.5 pl-10 pr-3 text-sm ${
                  active
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <c.icon
                  className={`h-3.5 w-3.5 ${
                    active ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-300"
                  }`}
                />
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MobileNav({
  role,
  attendanceOnly = false,
}: {
  role?: string | null;
  attendanceOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = visibleNavItems(role, attendanceOnly);

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
          <aside className="fixed left-0 top-0 flex h-full w-64 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-4 text-zinc-300 shadow-2xl">
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
              {items.map((item) => (
                <MobileRow key={item.href} item={item} pathname={pathname} />
              ))}
              <a
                href="https://xeltrixchem.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              >
                <Globe className="h-4 w-4 text-zinc-500" />
                Our website
              </a>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
