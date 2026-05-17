import "server-only";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { zohoFetch, getIntegrationForTeam } from "./client";
import type {
  IntegrationRow,
  ZohoContact,
  ZohoEstimate,
  ZohoInvoice,
  ZohoItem,
} from "./types";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSbAdmin(url, srk, { auth: { persistSession: false } });
}

type SyncCounts = {
  customers: number;
  invoices: number;
  items: number;
  quotes: number;
  warnings: string[];
};

async function getDefaultOwnerId(team_id: string): Promise<string | null> {
  const sb = adminClient();
  const { data } = await sb
    .from("team_members")
    .select("id, role")
    .eq("team_id", team_id)
    .eq("active", true)
    .in("role", ["admin", "manager"])
    .order("role");
  return data?.[0]?.id ?? null;
}

async function fetchAll<T>(
  integration: IntegrationRow,
  path: string,
  arrayKey: string,
  extraQuery: Record<string, string | number> = {}
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const res = await zohoFetch<Record<string, T[]>>(integration, path, {
      query: { page, per_page: 200, ...extraQuery },
    });
    const list = res[arrayKey] ?? [];
    out.push(...list);
    if (list.length < 200) break;
    page++;
    if (page > 50) break;
  }
  return out;
}

export async function syncFromZoho(integration: IntegrationRow): Promise<SyncCounts> {
  const sb = adminClient();
  const counts: SyncCounts = { customers: 0, invoices: 0, items: 0, quotes: 0, warnings: [] };
  const defaultOwner = await getDefaultOwnerId(integration.team_id);

  // ---- Contacts -> leads ----
  const contacts = await fetchAll<ZohoContact>(integration, "/contacts", "contacts", {
    contact_type: "customer",
  });

  const { data: existingLeads } = await sb
    .from("leads")
    .select("zoho_customer_id, owner_id")
    .eq("team_id", integration.team_id)
    .not("zoho_customer_id", "is", null);
  const leadOwnerMap = new Map(
    (existingLeads ?? []).map((l) => [l.zoho_customer_id as string, l.owner_id])
  );

  const leadRows = contacts.map((c) => ({
    team_id: integration.team_id,
    zoho_customer_id: c.contact_id,
    name: c.contact_name || c.company_name || "(no name)",
    email: c.email ?? null,
    phone: c.phone ?? c.mobile ?? null,
    source: "zoho_books",
    status: "qualified",
    owner_id: leadOwnerMap.get(c.contact_id) ?? defaultOwner,
  }));

  if (leadRows.length > 0) {
    const { error } = await sb
      .from("leads")
      .upsert(leadRows, { onConflict: "team_id,zoho_customer_id" });
    if (error) throw new Error(`leads bulk upsert failed: ${error.message}`);
  }
  counts.customers = leadRows.length;

  const { data: refreshedLeads } = await sb
    .from("leads")
    .select("id, zoho_customer_id")
    .eq("team_id", integration.team_id)
    .not("zoho_customer_id", "is", null);
  const customerToLead = new Map(
    (refreshedLeads ?? []).map((l) => [l.zoho_customer_id as string, l.id])
  );

  // ---- Items -> opportunity_templates ----
  const items = await fetchAll<ZohoItem>(integration, "/items", "items");
  const itemRows = items.map((it) => ({
    team_id: integration.team_id,
    zoho_item_id: it.item_id,
    name: it.name,
    sku: it.sku ?? null,
    rate: it.rate ?? null,
    unit: it.unit ?? null,
    active: (it.status ?? "active") === "active",
    updated_at: new Date().toISOString(),
  }));
  if (itemRows.length > 0) {
    const { error } = await sb
      .from("opportunity_templates")
      .upsert(itemRows, { onConflict: "team_id,zoho_item_id" });
    if (error) throw new Error(`opportunity_templates bulk upsert failed: ${error.message}`);
  }
  counts.items = itemRows.length;

  // ---- Invoices -> won opportunities ----
  const invoices = await fetchAll<ZohoInvoice>(integration, "/invoices", "invoices", {
    sort_column: "created_time",
    sort_order: "D",
  });
  const { data: existingOpps } = await sb
    .from("opportunities")
    .select("zoho_invoice_id, owner_id")
    .eq("team_id", integration.team_id)
    .not("zoho_invoice_id", "is", null);
  const oppOwnerMap = new Map(
    (existingOpps ?? []).map((o) => [o.zoho_invoice_id as string, o.owner_id])
  );

  const oppRows = invoices.map((inv) => ({
    team_id: integration.team_id,
    lead_id: customerToLead.get(inv.customer_id) ?? null,
    zoho_invoice_id: inv.invoice_id,
    zoho_customer_id: inv.customer_id,
    title: `${inv.invoice_number} · ${inv.customer_name}`,
    value: inv.total,
    stage: "won",
    close_date: inv.date,
    probability: 100,
    owner_id: oppOwnerMap.get(inv.invoice_id) ?? defaultOwner,
  }));
  if (oppRows.length > 0) {
    const { error } = await sb
      .from("opportunities")
      .upsert(oppRows, { onConflict: "team_id,zoho_invoice_id" });
    if (error) throw new Error(`opportunities bulk upsert failed: ${error.message}`);
  }
  counts.invoices = oppRows.length;

  // ---- Estimates -> quotes ----
  let estimates: ZohoEstimate[] = [];
  try {
    estimates = await fetchAll<ZohoEstimate>(integration, "/estimates", "estimates", {
      sort_column: "created_time",
      sort_order: "D",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    counts.warnings.push(`Quotes skipped: ${msg}`);
  }

  if (estimates.length > 0) {
    const { data: existingQuotes } = await sb
      .from("quotes")
      .select("zoho_estimate_id, owner_id")
      .eq("team_id", integration.team_id)
      .not("zoho_estimate_id", "is", null);
    const quoteOwnerMap = new Map(
      (existingQuotes ?? []).map((q) => [q.zoho_estimate_id as string, q.owner_id])
    );

    const quoteRows = estimates.map((est) => ({
      team_id: integration.team_id,
      lead_id: customerToLead.get(est.customer_id) ?? null,
      zoho_estimate_id: est.estimate_id,
      number: est.estimate_number,
      status: est.status,
      value: est.total,
      currency: est.currency_code ?? null,
      date: est.date,
      expiry_date: est.expiry_date ?? null,
      customer_id: est.customer_id,
      customer_name: est.customer_name,
      owner_id: quoteOwnerMap.get(est.estimate_id) ?? defaultOwner,
    }));

    const { error } = await sb
      .from("quotes")
      .upsert(quoteRows, { onConflict: "team_id,zoho_estimate_id" });
    if (error) throw new Error(`quotes bulk upsert failed: ${error.message}`);
    counts.quotes = quoteRows.length;
  }

  await sb
    .from("integrations")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: counts.warnings.length ? counts.warnings.join("; ") : null,
    })
    .eq("id", integration.id);

  return counts;
}

// Push: when an opp moves to "won" in our app and has no zoho_invoice_id,
// create a draft invoice in Zoho Books and store the returned id.
export async function pushWonOpportunityToZoho(opportunityId: string) {
  const sb = adminClient();
  const { data: opp } = await sb
    .from("opportunities")
    .select("id, team_id, title, value, close_date, lead_id, zoho_invoice_id, zoho_customer_id")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) return;
  if (opp.zoho_invoice_id) return;

  const integration = await getIntegrationForTeam(opp.team_id, true);
  if (!integration?.access_token) return;

  let zohoCustomerId = opp.zoho_customer_id ?? null;
  if (!zohoCustomerId && opp.lead_id) {
    const { data: lead } = await sb
      .from("leads")
      .select("name, email, phone, zoho_customer_id")
      .eq("id", opp.lead_id)
      .maybeSingle();
    if (lead?.zoho_customer_id) {
      zohoCustomerId = lead.zoho_customer_id;
    } else if (lead) {
      const created = await zohoFetch<{ contact: { contact_id: string } }>(
        integration,
        "/contacts",
        {
          method: "POST",
          body: {
            contact_name: lead.name,
            contact_type: "customer",
            email: lead.email ?? undefined,
            phone: lead.phone ?? undefined,
          },
        }
      );
      zohoCustomerId = created.contact.contact_id;
      await sb
        .from("leads")
        .update({ zoho_customer_id: zohoCustomerId })
        .eq("id", opp.lead_id);
    }
  }

  if (!zohoCustomerId) {
    throw new Error("Cannot push to Zoho: opportunity has no linked customer.");
  }

  const created = await zohoFetch<{ invoice: { invoice_id: string } }>(
    integration,
    "/invoices",
    {
      method: "POST",
      body: {
        customer_id: zohoCustomerId,
        date: opp.close_date ?? new Date().toISOString().slice(0, 10),
        line_items: [
          {
            name: opp.title,
            rate: Number(opp.value) || 0,
            quantity: 1,
          },
        ],
      },
    }
  );

  await sb
    .from("opportunities")
    .update({
      zoho_invoice_id: created.invoice.invoice_id,
      zoho_customer_id: zohoCustomerId,
    })
    .eq("id", opp.id);
}
