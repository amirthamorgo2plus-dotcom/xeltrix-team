import { NextResponse, type NextRequest } from "next/server";
import { authTenant, mirrorClient } from "@/lib/portal-api";

// GET .../invoices?from&to&status&include=line_items&page&per_page
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ zohoContactId: string }> }
) {
  const auth = authTenant(req);
  if ("error" in auth) return auth.error;
  const { zohoContactId } = await params;
  const sp = req.nextUrl.searchParams;
  const includeItems = sp.get("include") === "line_items";
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage = Math.min(200, Math.max(1, Number(sp.get("per_page") ?? 50)));
  const sb = mirrorClient();

  let q = sb.from("zoho_invoices")
    .select("zoho_invoice_id, invoice_number, date, due_date, status, sub_total, tax_total, total, balance", { count: "exact" })
    .eq("team_id", auth.tenantId)
    .eq("zoho_contact_id", zohoContactId)
    .order("date", { ascending: false });
  if (sp.get("from")) q = q.gte("date", sp.get("from")!);
  if (sp.get("to")) q = q.lte("date", sp.get("to")!);
  if (sp.get("status")) q = q.eq("status", sp.get("status")!);
  q = q.range((page - 1) * perPage, page * perPage - 1);

  const { data: invoices, count } = await q;
  let rows = invoices ?? [];

  if (includeItems && rows.length > 0) {
    const ids = rows.map((r) => r.zoho_invoice_id);
    const { data: items } = await sb.from("zoho_invoice_items")
      .select("zoho_invoice_id, line_item_id, zoho_item_id, sku, name, description, quantity, unit, rate, amount, tax_percentage")
      .eq("team_id", auth.tenantId).in("zoho_invoice_id", ids);
    const byInv = new Map<string, unknown[]>();
    for (const it of items ?? []) {
      const list = byInv.get(it.zoho_invoice_id) ?? [];
      list.push(it);
      byInv.set(it.zoho_invoice_id, list);
    }
    rows = rows.map((r) => ({ ...r, line_items: byInv.get(r.zoho_invoice_id) ?? [] }));
  }

  return NextResponse.json({ page, per_page: perPage, total: count ?? rows.length, invoices: rows });
}
