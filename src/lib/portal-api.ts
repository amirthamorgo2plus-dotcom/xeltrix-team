import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client for reading the Zoho mirror (bypasses RLS).
export function mirrorClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Authenticates the CALLING SERVER (shared secret) and resolves the tenant.
// The portal still enforces, session-side, that a customer may only request
// their own zohoContactId — that authorization boundary stays with the portal.
// Returns the tenant id, or an error response.
export function authTenant(
  req: NextRequest
): { tenantId: string } | { error: NextResponse } {
  const secret = req.headers.get("x-integration-secret");
  const expected = process.env.PORTAL_API_SECRET;
  if (!expected || secret !== expected) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const tenantId = req.headers.get("x-tenant-id") ?? process.env.PORTAL_DEFAULT_TENANT ?? "";
  if (!tenantId) {
    return { error: NextResponse.json({ error: "No tenant" }, { status: 400 }) };
  }
  return { tenantId };
}

type InvRow = { balance?: number | string | null; due_date?: string | null };

// Ageing buckets on outstanding balance, by due date.
export function ageingBuckets(inv: InvRow[], today: string) {
  const b = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of inv) {
    const bal = Number(r.balance ?? 0);
    if (bal <= 0) continue;
    if (!r.due_date || r.due_date >= today) { b.current += bal; continue; }
    const days = Math.floor((Date.parse(today) - Date.parse(r.due_date)) / 86_400_000);
    if (days <= 30) b["1-30"] += bal;
    else if (days <= 60) b["31-60"] += bal;
    else if (days <= 90) b["61-90"] += bal;
    else b["90+"] += bal;
  }
  return b;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
