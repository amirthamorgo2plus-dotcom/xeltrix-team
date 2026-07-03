import { NextResponse, type NextRequest } from "next/server";
import { authTenant, mirrorClient } from "@/lib/portal-api";

// Flat line-item feed for the portal's Products & Insights lifetime aggregation:
// one call returns all of a customer's invoice line items (with invoice date).
// GET .../line-items?from&to
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ zohoContactId: string }> }
) {
  const auth = authTenant(req);
  if ("error" in auth) return auth.error;
  const { zohoContactId } = await params;
  const sp = req.nextUrl.searchParams;
  const sb = mirrorClient();

  // 1) the customer's invoices (id + date), 2) their line items.
  let iq = sb.from("zoho_invoices")
    .select("zoho_invoice_id, invoice_number, date")
    .eq("team_id", auth.tenantId).eq("zoho_contact_id", zohoContactId);
  if (sp.get("from")) iq = iq.gte("date", sp.get("from")!);
  if (sp.get("to")) iq = iq.lte("date", sp.get("to")!);
  const { data: invoices } = await iq;
  const invs = invoices ?? [];
  if (invs.length === 0) return NextResponse.json({ line_items: [] });

  const meta = new Map(invs.map((r) => [r.zoho_invoice_id, { invoice_number: r.invoice_number, date: r.date }]));
  const { data: items } = await sb.from("zoho_invoice_items")
    .select("zoho_invoice_id, zoho_item_id, sku, name, quantity, unit, rate, amount")
    .eq("team_id", auth.tenantId).in("zoho_invoice_id", [...meta.keys()]);

  const line_items = (items ?? []).map((it) => ({
    ...it,
    invoice_number: meta.get(it.zoho_invoice_id)?.invoice_number ?? null,
    date: meta.get(it.zoho_invoice_id)?.date ?? null,
  }));
  return NextResponse.json({ line_items });
}
