import { NextResponse, type NextRequest } from "next/server";
import { authTenant, mirrorClient } from "@/lib/portal-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ zohoContactId: string; invoiceId: string }> }
) {
  const auth = authTenant(req);
  if ("error" in auth) return auth.error;
  const { zohoContactId, invoiceId } = await params;
  const sb = mirrorClient();

  const { data: invoice } = await sb.from("zoho_invoices").select("*")
    .eq("team_id", auth.tenantId)
    .eq("zoho_contact_id", zohoContactId)   // ownership: invoice must belong to this customer
    .eq("zoho_invoice_id", invoiceId)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: line_items } = await sb.from("zoho_invoice_items")
    .select("line_item_id, zoho_item_id, sku, name, description, quantity, unit, rate, amount, tax_percentage")
    .eq("team_id", auth.tenantId).eq("zoho_invoice_id", invoiceId);

  return NextResponse.json({ synced_at: invoice.synced_at ?? null, invoice: { ...invoice, line_items: line_items ?? [] } });
}
