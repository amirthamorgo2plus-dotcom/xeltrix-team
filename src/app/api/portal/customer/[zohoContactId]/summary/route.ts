import { NextResponse, type NextRequest } from "next/server";
import { authTenant, mirrorClient, ageingBuckets, todayISO } from "@/lib/portal-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ zohoContactId: string }> }
) {
  const auth = authTenant(req);
  if ("error" in auth) return auth.error;
  const { zohoContactId } = await params;
  const sb = mirrorClient();

  const [{ data: contact }, { data: invoices }] = await Promise.all([
    sb.from("zoho_contacts").select("*")
      .eq("team_id", auth.tenantId).eq("zoho_contact_id", zohoContactId).maybeSingle(),
    sb.from("zoho_invoices")
      .select("zoho_invoice_id, invoice_number, date, due_date, status, total, balance")
      .eq("team_id", auth.tenantId).eq("zoho_contact_id", zohoContactId)
      .order("date", { ascending: false }),
  ]);

  const inv = invoices ?? [];
  const today = todayISO();
  const outstanding = inv.reduce((s, r) => s + Number(r.balance ?? 0), 0);
  const overdue = inv
    .filter((r) => Number(r.balance ?? 0) > 0 && r.due_date && r.due_date < today)
    .reduce((s, r) => s + Number(r.balance ?? 0), 0);
  const creditLimit = contact?.credit_limit != null ? Number(contact.credit_limit) : null;

  return NextResponse.json({
    synced_at: contact?.synced_at ?? null,
    contact: contact
      ? {
          zoho_contact_id: contact.zoho_contact_id,
          name: contact.name,
          company_name: contact.company_name,
          gstin: contact.gstin,
          city: contact.city,
        }
      : null,
    credit: {
      credit_limit: creditLimit,                 // live from sync
      payment_terms: contact?.payment_terms ?? null,
      payment_terms_label: contact?.payment_terms_label ?? null,
      outstanding,
      available_credit: creditLimit != null ? creditLimit - outstanding : null,
      overdue,
    },
    ageing: ageingBuckets(inv, today),
    recent_invoices: inv.slice(0, 10),
  });
}
