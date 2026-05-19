import "server-only";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { zohoFetch, getIntegrationForTeam } from "./client";
import type {
  IntegrationRow,
  ZohoContact,
  ZohoEstimate,
  ZohoExpense,
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
  expenses: number;
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

// Zoho sometimes sends empty strings for missing date fields; Postgres rejects ""
function toDateOrNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
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

// Zoho's list endpoints (/invoices, /estimates) don't include sub_total or
// tax_total — only the detail endpoint does. This batches detail fetches
// with a concurrency cap and returns a map of id -> {sub_total, tax_total}.
async function fetchTaxBreakdowns(
  integration: IntegrationRow,
  resource: "invoices" | "estimates",
  ids: string[],
  concurrency = 3
): Promise<{
  map: Map<string, { sub_total: number; tax_total: number }>;
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
}> {
  const out = new Map<string, { sub_total: number; tax_total: number }>();
  const key = resource === "invoices" ? "invoice" : "estimate";
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await zohoFetch<Record<string, { sub_total?: number; tax_total?: number }>>(
            integration,
            `/${resource}/${id}`
          );
          const data = res[key];
          if (!data) {
            return { id, ok: false as const, error: `no '${key}' key in response` };
          }
          if (data.sub_total === undefined && data.tax_total === undefined) {
            // Detail came back but no breakdown fields — unexpected
            return { id, ok: false as const, error: `${resource}/${id}: missing sub_total/tax_total` };
          }
          return {
            id,
            ok: true as const,
            sub_total: Number(data.sub_total ?? 0),
            tax_total: Number(data.tax_total ?? 0),
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { id, ok: false as const, error: `${resource}/${id}: ${msg}` };
        }
      })
    );
    results.forEach((r) => {
      if (r.ok) {
        out.set(r.id, { sub_total: r.sub_total, tax_total: r.tax_total });
        succeeded++;
      } else {
        failed++;
        if (errors.length < 3) errors.push(r.error);
      }
    });
  }
  return { map: out, attempted: ids.length, succeeded, failed, errors };
}

export async function syncFromZoho(integration: IntegrationRow): Promise<SyncCounts> {
  const sb = adminClient();
  const counts: SyncCounts = { customers: 0, invoices: 0, items: 0, quotes: 0, expenses: 0, warnings: [] };
  const defaultOwner = await getDefaultOwnerId(integration.team_id);

  // Map Zoho salesperson name -> Xeltrix team_members.id (configured by admin)
  const { data: mappedMembers } = await sb
    .from("team_members")
    .select("id, zoho_salesperson_name")
    .eq("team_id", integration.team_id)
    .eq("active", true)
    .not("zoho_salesperson_name", "is", null);
  const salespersonToMember = new Map(
    (mappedMembers ?? []).map((m) => [m.zoho_salesperson_name as string, m.id])
  );
  const resolveOwner = (salespersonName: string | undefined, fallback: string | null) =>
    (salespersonName ? salespersonToMember.get(salespersonName) ?? null : null) ?? fallback;

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

  // ---- Estimates -> quotes + proposal-stage opportunities ----
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
      .select("zoho_estimate_id, owner_id, value_excl_tax")
      .eq("team_id", integration.team_id)
      .not("zoho_estimate_id", "is", null);
    const quoteOwnerMap = new Map(
      (existingQuotes ?? []).map((q) => [q.zoho_estimate_id as string, q.owner_id])
    );
    const quotesWithTax = new Set(
      (existingQuotes ?? [])
        .filter((q) => q.value_excl_tax !== null)
        .map((q) => q.zoho_estimate_id as string)
    );

    // Detail-fetch tax breakdowns for estimates we don't already have it for
    const estIdsNeedingDetail = estimates
      .map((e) => e.estimate_id)
      .filter((id) => !quotesWithTax.has(id));
    const estDetail = await fetchTaxBreakdowns(integration, "estimates", estIdsNeedingDetail);
    counts.warnings.push(
      `Estimate details: ${estDetail.succeeded}/${estDetail.attempted} ok, ${estDetail.failed} failed`
    );
    if (estDetail.errors.length > 0) {
      counts.warnings.push(`Est errors: ${estDetail.errors.join(" | ")}`);
    }
    // Merge: prefer fresh tax data, fall back to whatever list response had
    const estTaxFor = (est: ZohoEstimate) => {
      const detail = estDetail.map.get(est.estimate_id);
      if (detail) return detail;
      return {
        sub_total: est.sub_total ?? 0,
        tax_total: est.tax_total ?? 0,
      };
    };

    const quoteRows = estimates.map((est) => ({
      team_id: integration.team_id,
      lead_id: customerToLead.get(est.customer_id) ?? null,
      zoho_estimate_id: est.estimate_id,
      number: est.estimate_number,
      status: est.status,
      value: est.total,
      value_excl_tax: estTaxFor(est).sub_total || null,
      tax_amount: estTaxFor(est).tax_total || null,
      currency: est.currency_code ?? null,
      date: toDateOrNull(est.date),
      expiry_date: toDateOrNull(est.expiry_date),
      customer_id: est.customer_id,
      customer_name: est.customer_name,
      zoho_salesperson_id: est.salesperson_id ?? null,
      zoho_salesperson_name: est.salesperson_name ?? null,
      owner_id:
        quoteOwnerMap.get(est.estimate_id) ?? resolveOwner(est.salesperson_name, defaultOwner),
    }));

    const { error } = await sb
      .from("quotes")
      .upsert(quoteRows, { onConflict: "team_id,zoho_estimate_id" });
    if (error) throw new Error(`quotes bulk upsert failed: ${error.message}`);
    counts.quotes = quoteRows.length;

    // For estimates that aren't declined/expired, create a proposal-stage opp
    // (but never overwrite a won/lost opp already there)
    const { data: existingOppsForEsts } = await sb
      .from("opportunities")
      .select("zoho_estimate_id, stage")
      .eq("team_id", integration.team_id)
      .in(
        "zoho_estimate_id",
        estimates.map((e) => e.estimate_id)
      );
    const skipEstimateIds = new Set(
      (existingOppsForEsts ?? [])
        .filter((o) => o.stage === "won" || o.stage === "lost")
        .map((o) => o.zoho_estimate_id as string)
    );

    const proposalOppRows = estimates
      .filter(
        (est) =>
          !skipEstimateIds.has(est.estimate_id) &&
          !["declined", "expired"].includes((est.status ?? "").toLowerCase())
      )
      .map((est) => {
        const tax = estTaxFor(est);
        return {
          team_id: integration.team_id,
          lead_id: customerToLead.get(est.customer_id) ?? null,
          zoho_estimate_id: est.estimate_id,
          zoho_customer_id: est.customer_id,
          title: `${est.estimate_number} · ${est.customer_name}`,
          value: est.total,
          value_excl_tax: tax.sub_total || null,
          tax_amount: tax.tax_total || null,
          stage: "proposal",
          close_date: toDateOrNull(est.expiry_date) || toDateOrNull(est.date),
          probability: 50,
          zoho_salesperson_id: est.salesperson_id ?? null,
          zoho_salesperson_name: est.salesperson_name ?? null,
          owner_id: resolveOwner(est.salesperson_name, defaultOwner),
        };
      });

    if (proposalOppRows.length > 0) {
      const { error: oppErr } = await sb
        .from("opportunities")
        .upsert(proposalOppRows, { onConflict: "team_id,zoho_estimate_id" });
      if (oppErr) throw new Error(`proposal opps upsert failed: ${oppErr.message}`);
    }
  }

  // ---- Invoices -> won opportunities (linked to proposal opp if estimate matches) ----
  const invoices = await fetchAll<ZohoInvoice>(integration, "/invoices", "invoices", {
    sort_column: "created_time",
    sort_order: "D",
  });
  const { data: existingOpps } = await sb
    .from("opportunities")
    .select("id, zoho_invoice_id, zoho_estimate_id, owner_id, value_excl_tax")
    .eq("team_id", integration.team_id);
  const oppOwnerMapByInv = new Map(
    (existingOpps ?? [])
      .filter((o) => o.zoho_invoice_id)
      .map((o) => [o.zoho_invoice_id as string, o.owner_id])
  );
  const oppIdByEstimate = new Map(
    (existingOpps ?? [])
      .filter((o) => o.zoho_estimate_id)
      .map((o) => [o.zoho_estimate_id as string, o.id])
  );
  // Diagnostic: how many opps did we get back, how many have invoice ids, and
  // how many of those have value_excl_tax populated already?
  const oppsCount = (existingOpps ?? []).length;
  const oppsWithInv = (existingOpps ?? []).filter((o) => o.zoho_invoice_id).length;
  const oppsWithInvAndTax = (existingOpps ?? []).filter(
    (o) => o.zoho_invoice_id && o.value_excl_tax !== null && o.value_excl_tax !== undefined
  ).length;

  const invoicesWithTax = new Set(
    (existingOpps ?? [])
      .filter(
        (o) =>
          o.zoho_invoice_id &&
          o.value_excl_tax !== null &&
          o.value_excl_tax !== undefined
      )
      .map((o) => o.zoho_invoice_id as string)
  );

  // Detail-fetch tax breakdowns for invoices missing them
  const invIdsNeedingDetail = invoices
    .map((inv) => inv.invoice_id)
    .filter((id) => !invoicesWithTax.has(id));

  counts.warnings.push(
    `Opps: ${oppsCount} total, ${oppsWithInv} with inv_id, ${oppsWithInvAndTax} already tax. List: ${invoices.length} invoices. Need detail: ${invIdsNeedingDetail.length}`
  );

  const invDetail = await fetchTaxBreakdowns(integration, "invoices", invIdsNeedingDetail);
  counts.warnings.push(
    `Invoice details: ${invDetail.succeeded}/${invDetail.attempted} ok, ${invDetail.failed} failed`
  );
  if (invDetail.errors.length > 0) {
    counts.warnings.push(`Inv errors: ${invDetail.errors.join(" | ")}`);
  }
  const invTaxFor = (inv: ZohoInvoice) => {
    const detail = invDetail.map.get(inv.invoice_id);
    if (detail) return detail;
    return {
      sub_total: inv.sub_total ?? 0,
      tax_total: inv.tax_total ?? 0,
    };
  };

  // Pass 1: for invoices with an estimate_id, update the existing proposal opp -> won
  const linkedInvoiceIds = new Set<string>();
  for (const inv of invoices) {
    if (!inv.estimate_id) continue;
    const existingOppId = oppIdByEstimate.get(inv.estimate_id);
    if (!existingOppId) continue;
    linkedInvoiceIds.add(inv.invoice_id);
    const tax = invTaxFor(inv);
    await sb
      .from("opportunities")
      .update({
        zoho_invoice_id: inv.invoice_id,
        zoho_customer_id: inv.customer_id,
        title: `${inv.invoice_number} · ${inv.customer_name}`,
        value: inv.total,
        value_excl_tax: tax.sub_total || null,
        tax_amount: tax.tax_total || null,
        stage: "won",
        close_date: toDateOrNull(inv.date),
        probability: 100,
        zoho_salesperson_id: inv.salesperson_id ?? null,
        zoho_salesperson_name: inv.salesperson_name ?? null,
      })
      .eq("id", existingOppId);
  }

  // Pass 2: invoices without a linked estimate -> upsert new won opp by invoice id
  const unlinkedInvoices = invoices.filter((inv) => !linkedInvoiceIds.has(inv.invoice_id));
  const oppRows = unlinkedInvoices.map((inv) => {
    const tax = invTaxFor(inv);
    return {
      team_id: integration.team_id,
      lead_id: customerToLead.get(inv.customer_id) ?? null,
      zoho_invoice_id: inv.invoice_id,
      zoho_customer_id: inv.customer_id,
      title: `${inv.invoice_number} · ${inv.customer_name}`,
      value: inv.total,
      value_excl_tax: tax.sub_total || null,
      tax_amount: tax.tax_total || null,
      stage: "won",
      close_date: toDateOrNull(inv.date),
      probability: 100,
      zoho_salesperson_id: inv.salesperson_id ?? null,
      zoho_salesperson_name: inv.salesperson_name ?? null,
      owner_id:
        oppOwnerMapByInv.get(inv.invoice_id) ?? resolveOwner(inv.salesperson_name, defaultOwner),
    };
  });
  if (oppRows.length > 0) {
    const { error } = await sb
      .from("opportunities")
      .upsert(oppRows, { onConflict: "team_id,zoho_invoice_id" });
    if (error) throw new Error(`opportunities bulk upsert failed: ${error.message}`);
  }
  counts.invoices = invoices.length;

  // ---- Expenses (Zoho Books → zoho_expenses) ----
  try {
    const expenses = await fetchAll<ZohoExpense>(integration, "/expenses", "expenses", {
      sort_column: "date",
      sort_order: "D",
    });
    if (expenses.length > 0) {
      const expenseRows = expenses.map((e) => ({
        team_id: integration.team_id,
        zoho_expense_id: e.expense_id,
        date: toDateOrNull(e.date),
        account_id: e.account_id ?? null,
        account_name: e.account_name ?? null,
        paid_through_account_id: e.paid_through_account_id ?? null,
        paid_through_account_name: e.paid_through_account_name ?? null,
        vendor_id: e.vendor_id ?? null,
        vendor_name: e.vendor_name ?? null,
        customer_id: e.customer_id ?? null,
        customer_name: e.customer_name ?? null,
        amount: e.total ?? 0,
        currency_code: e.currency_code ?? null,
        reference_number: e.reference_number ?? null,
        description: e.description ?? null,
        status: e.status ?? null,
        location: e.location ?? null,
      }));
      const { error: expErr } = await sb
        .from("zoho_expenses")
        .upsert(expenseRows, { onConflict: "team_id,zoho_expense_id" });
      if (expErr) throw new Error(`expenses upsert failed: ${expErr.message}`);
      counts.expenses = expenseRows.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    counts.warnings.push(`Expenses skipped: ${msg}`);
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
