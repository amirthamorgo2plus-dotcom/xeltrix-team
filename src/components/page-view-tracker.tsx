"use client";

import { usePathname } from "next/navigation";
import { usePageView } from "@/hooks/usePageView";

// Admin-only areas we don't track (mirrors the adminOnly items in nav-items.ts
// + the super-admin /admin area). Keep in sync if admin-only routes change.
const SKIP_PREFIXES = [
  "/admin",
  "/team",
  "/integrations",
  "/payments",
  "/price-lists",
  "/deep-cleaning",
  "/tasks/routines",
];

// Rendered once in the root layout; captures all client-side navigation.
export function PageViewTracker() {
  const pathname = usePathname();
  const skip = !pathname || SKIP_PREFIXES.some((p) => pathname.startsWith(p));
  usePageView(skip ? "" : pathname);
  return null;
}
