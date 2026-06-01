"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Globe } from "lucide-react";
import { visibleNavItems, type NavItem } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(href + "/");
}

function NavRow({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const { href, label, icon: Icon, children } = item;
  const hasChildren = !!children && children.length > 0;
  const selfActive = isActive(pathname, href);
  const childActive =
    hasChildren && children!.some((c) => isActive(pathname, c.href));
  // Expand when this branch is active; allow manual toggle on top of that.
  const [open, setOpen] = useState(selfActive || childActive);
  const expanded = open || childActive;

  return (
    <div>
      <div
        className={`group relative flex items-center rounded-md text-sm transition-colors ${
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
            className={`h-4 w-4 transition-colors ${
              selfActive
                ? "text-emerald-400"
                : "text-zinc-500 group-hover:text-zinc-200"
            }`}
          />
          <span className="truncate">{label}</span>
        </Link>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-200"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
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
                className={`group relative flex items-center gap-3 rounded-md py-1.5 pl-10 pr-3 text-sm transition-colors ${
                  active
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1 left-7 w-0.5 rounded-r bg-emerald-400" />
                )}
                <c.icon
                  className={`h-3.5 w-3.5 ${
                    active ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-300"
                  }`}
                />
                <span className="truncate">{c.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
        {items.map((item) => (
          <NavRow key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <a
        href="https://xeltrixchem.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
      >
        <Globe className="h-4 w-4 text-zinc-500" />
        <span className="truncate">Our website</span>
      </a>

      <div className="mt-2 border-t border-zinc-800 pt-3 text-[10px] uppercase tracking-wider text-zinc-600">
        v1 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
