import { NextResponse, type NextRequest } from "next/server";
import { authTenant, mirrorClient } from "@/lib/portal-api";

// GET .../payments?from&to  → payments with per-invoice allocations (Statement ledger)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ zohoContactId: string }> }
) {
  const auth = authTenant(req);
  if ("error" in auth) return auth.error;
  const { zohoContactId } = await params;
  const sp = req.nextUrl.searchParams;
  const sb = mirrorClient();

  let q = sb.from("zoho_payments")
    .select("zoho_payment_id, date, amount, payment_mode, reference_number")
    .eq("team_id", auth.tenantId).eq("zoho_contact_id", zohoContactId)
    .order("date", { ascending: false });
  if (sp.get("from")) q = q.gte("date", sp.get("from")!);
  if (sp.get("to")) q = q.lte("date", sp.get("to")!);
  const { data: payments } = await q;
  const rows = payments ?? [];

  let byPayment = new Map<string, unknown[]>();
  if (rows.length > 0) {
    const ids = rows.map((r) => r.zoho_payment_id);
    const { data: allocs } = await sb.from("zoho_payment_allocations")
      .select("zoho_payment_id, zoho_invoice_id, invoice_number, amount_applied")
      .eq("team_id", auth.tenantId).in("zoho_payment_id", ids);
    byPayment = new Map();
    for (const a of allocs ?? []) {
      const list = byPayment.get(a.zoho_payment_id) ?? [];
      list.push({ zoho_invoice_id: a.zoho_invoice_id, invoice_number: a.invoice_number, amount_applied: a.amount_applied });
      byPayment.set(a.zoho_payment_id, list);
    }
  }

  return NextResponse.json({
    payments: rows.map((p) => ({ ...p, allocations: byPayment.get(p.zoho_payment_id) ?? [] })),
  });
}
