import "server-only";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { zohoFetch, getIntegrationForTeam } from "./client";
import type {
  IntegrationRow,
  ZohoContact,
  ZohoEstimate,
  ZohoExpense,
  ZohoInvoice,
  ZohoInvoiceLineItem,
  ZohoItem,
  ZohoPayment,
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

// Map Zoho invoice status -> our pipeline stage.
// Drafts/voids must NOT be counted as won — Zoho's Sales by Salesperson
// report excludes them, so our dashboard should too.
function invoiceStageFor(status: string | undefined): string {
  const s = (status ?? "").toLowerCase().trim();
  if (s === "void" || s === "cancelled") return "lost";
  if (s === "draft") return "proposal";
  // paid, sent, viewed, partially_paid, overdue, unpaid, etc.
  return "won";
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

// Combine a Zoho address object into a single text line for geocoding.
function formatZohoAddress(a?: {
  address?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): string | null {
  if (!a) return null;
  const parts = [a.address, a.street2, a.city, a.state, a.zip, a.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// Contact addresses (billing/shipping) are ONLY returned by the detail
// endpoint /contacts/{id}, not the /contacts list. Time-budgeted + concurrency
// -capped, mirroring fetchTaxBreakdowns. Returns id -> address line.
async function fetchContactAddresses(
  integration: IntegrationRow,
  contactIds: string[],
  opts: { concurrency?: number; deadlineMs?: number } = {}
): Promise<{
  map: Map<string, string>;
  credit: Array<{
    zoho_contact_id: string;
    credit_limit: number | null;
    payment_terms: number | null;
    payment_terms_label: string | null;
    gstin: string | null;
    city: string | null;
  }>;
  skipped: number;
  diag: { hadBilling: number; hadShipping: number; example: string };
}> {
  const concurrency = opts.concurrency ?? 6;
  const deadline = opts.deadlineMs ?? Number.POSITIVE_INFINITY;
  const out = new Map<string, string>();
  const credit: Array<{
    zoho_contact_id: string;
    credit_limit: number | null;
    payment_terms: number | null;
    payment_terms_label: string | null;
    gstin: string | null;
    city: string | null;
  }> = [];
  let processed = 0;
  // Count how many contacts actually carry a usable address, and capture one
  // real found address so we can confirm parsing works on a filled contact.
  let hadBilling = 0;
  let hadShipping = 0;
  let example = "";

  for (let i = 0; i < contactIds.length; i += concurrency) {
    if (Date.now() > deadline) break;
    const batch = contactIds.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await zohoFetch<{ contact?: ZohoContact }>(
            integration,
            `/contacts/${id}`
          );
          const c = res.contact;
          if (c) {
            if (formatZohoAddress(c.billing_address)) hadBilling++;
            if (formatZohoAddress(c.shipping_address)) hadShipping++;
          }
          const address = c
            ? formatZohoAddress(c.billing_address) ??
              formatZohoAddress(c.shipping_address)
            : null;
          if (address && !example) example = address.slice(0, 120);
          const cr = c
            ? {
                zoho_contact_id: id,
                credit_limit: c.credit_limit ?? null,
                payment_terms: c.payment_terms ?? null,
                payment_terms_label: c.payment_terms_label ?? null,
                gstin: c.gst_no ?? null,
                city: c.billing_address?.city ?? c.shipping_address?.city ?? null,
              }
            : null;
          return { id, address, credit: cr };
        } catch {
          return { id, address: null as string | null, credit: null };
        }
      })
    );
    results.forEach((r) => {
      if (r.address) out.set(r.id, r.address);
      if (r.credit) credit.push(r.credit);
    });
    processed = Math.min(i + concurrency, contactIds.length);
  }
  return {
    map: out,
    credit,
    skipped: contactIds.length - processed,
    diag: { hadBilling, hadShipping, example },
  };
}

// Zoho's list endpoints (/invoices, /estimates) don't include sub_total or
// tax_total — only the detail endpoint does. This batches detail fetches
// with a concurrency cap and returns a map of id -> {sub_total, tax_total}.
async function fetchTaxBreakdowns(
  integration: IntegrationRow,
  resource: "invoices" | "estimates",
  ids: string[],
  opts: { concurrency?: number; deadlineMs?: number } = {}
): Promise<{
  map: Map<string, { sub_total: number; tax_total: number; balance?: number; due_date?: string | null; invoice_status?: string; line_items?: ZohoInvoiceLineItem[] }>;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const concurrency = opts.concurrency ?? 3;
  const deadline = opts.deadlineMs ?? Number.POSITIVE_INFINITY;
  const out = new Map<string, { sub_total: number; tax_total: number; balance?: number; due_date?: string | null; invoice_status?: string; line_items?: ZohoInvoiceLineItem[] }>();
  const key = resource === "invoices" ? "invoice" : "estimate";
  let succeeded = 0;
  let failed = 0;
  let processed = 0;
  const errors: string[] = [];

  for (let i = 0; i < ids.length; i += concurrency) {
    if (Date.now() > deadline) break;
    processed = i;
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await zohoFetch<Record<string, { sub_total?: number; tax_total?: number; balance?: number; due_date?: string; status?: string; line_items?: ZohoInvoiceLineItem[] }>>(
            integration,
            `/${resource}/${id}`
          );
          const data = res[key];
          if (!data) {
            return { id, ok: false as const, error: `no '${key}' key in response` };
          }
          if (data.sub_total === undefined && data.tax_total === undefined) {
            return { id, ok: false as const, error: `${resource}/${id}: missing sub_total/tax_total` };
          }
          return {
            id,
            ok: true as const,
            sub_total: Number(data.sub_total ?? 0),
            tax_total: Number(data.tax_total ?? 0),
            balance: data.balance !== undefined ? Number(data.balance) : undefined,
            due_date: data.due_date ?? null,
            invoice_status: data.status ?? undefined,
            line_items: data.line_items,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { id, ok: false as const, error: `${resource}/${id}: ${msg}` };
        }
      })
    );
    results.forEach((r) => {
      if (r.ok) {
        out.set(r.id, {
          sub_total: r.sub_total,
          tax_total: r.tax_total,
          balance: r.balance,
          due_date: r.due_date,
          invoice_status: r.invoice_status,
          line_items: r.line_items,
        });
        succeeded++;
      } else {
        failed++;
        if (errors.length < 3) errors.push(r.error);
      }
    });
    processed = Math.min(i + concurrency, ids.length);
  }
  const skipped = ids.length - processed;
  return { map: out, attempted: processed, succeeded, failed, skipped, errors };
}

export async function syncFromZoho(
  integration: IntegrationRow,
  options: { since?: string } = {}
): Promise<SyncCounts> {
  const sb = adminClient();
  const counts: SyncCounts = { customers: 0, invoices: 0, items: 0, quotes: 0, expenses: 0, warnings: [] };
  // Wall-clock budget for detail-fetches so we never blow the 60s function limit.
  const DETAIL_DEADLINE = Date.now() + 45_000;
  // First day of the current month — current-month docs are ALWAYS re-fetched
  // fresh (small set, ~12s) so the visible month never drifts from stale cache.
  const CURRENT_MONTH_START = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const defaultOwner = await getDefaultOwnerId(integration.team_id);

  // last_modified_time filter so each sync only pulls changes since the
  // given date. Default = 35 days ago (covers the whole current month
  // reliably). Pass an older date to backfill full history.
  const defaultSince = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 35);
    return d.toISOString().slice(0, 10);
  })();
  const sinceDate = options.since ?? defaultSince;
  const lastModifiedSince = `${sinceDate}T00:00:00+0530`;
  const sinceFilter = { last_modified_time: lastModifiedSince };
  counts.warnings.push(`Window: changes since ${sinceDate}`);

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
    ...sinceFilter,
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

  // ---- Mirror: zoho_contacts (Customer Portal read source) ----
  // List-level fields only; credit_limit/payment_terms/gstin/city come from the
  // contact-detail pass below (they're detail-endpoint only). Non-fatal.
  try {
    const contactMirror = contacts.map((c) => ({
      team_id: integration.team_id,
      zoho_contact_id: c.contact_id,
      name: c.contact_name || c.company_name || null,
      company_name: c.company_name ?? null,
      email: c.email ?? null,
      phone: c.phone ?? c.mobile ?? null,
      status: c.status ?? null,
      synced_at: new Date().toISOString(),
    }));
    if (contactMirror.length > 0) {
      await sb.from("zoho_contacts").upsert(contactMirror, { onConflict: "team_id,zoho_contact_id" });
    }
  } catch (e) {
    counts.warnings.push(`Mirror contacts skipped: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Addresses for geocoding: only on the /contacts/{id} detail endpoint, not
  // the list. Fetch detail ONLY for leads that don't have an address yet, so
  // this is incremental (cheap after the first couple of syncs). Give it a
  // small dedicated budget so it never starves the tax detail-fetch below.
  const { data: leadsNoAddress } = await sb
    .from("leads")
    .select("zoho_customer_id")
    .eq("team_id", integration.team_id)
    .is("address", null)
    .not("zoho_customer_id", "is", null);
  const needAddr = new Set(
    (leadsNoAddress ?? []).map((l) => l.zoho_customer_id as string)
  );
  // Also detail-fetch contacts missing credit_limit in the mirror, so
  // credit_limit/payment_terms/gstin populate even for contacts that already
  // have an address (the address pass alone would skip them). Bounded + budgeted.
  const { data: contactsNoCredit } = await sb
    .from("zoho_contacts")
    .select("zoho_contact_id")
    .eq("team_id", integration.team_id)
    .is("credit_limit", null);
  const needCredit = new Set(
    (contactsNoCredit ?? []).map((c) => c.zoho_contact_id as string)
  );
  const contactIdsForAddr = contacts
    .map((c) => c.contact_id)
    .filter((id) => needAddr.has(id) || needCredit.has(id));

  if (contactIdsForAddr.length > 0) {
    const ADDRESS_DEADLINE = Math.min(DETAIL_DEADLINE, Date.now() + 30_000);
    const addr = await fetchContactAddresses(integration, contactIdsForAddr, {
      concurrency: 6,
      deadlineMs: ADDRESS_DEADLINE,
    });
    // These leads already exist (upserted with names above), so UPDATE by
    // zoho_customer_id — an upsert would hit the INSERT path and trip the
    // NOT-NULL constraint on `name`, which we don't include here.
    const entries = [...addr.map.entries()];
    let updated = 0;
    for (let i = 0; i < entries.length; i += 5) {
      const slice = entries.slice(i, i + 5);
      await Promise.all(
        slice.map(async ([id, address]) => {
          const { error } = await sb
            .from("leads")
            .update({ address })
            .eq("team_id", integration.team_id)
            .eq("zoho_customer_id", id);
          if (!error) updated++;
        })
      );
    }
    counts.warnings.push(
      `Addresses: +${updated} fetched (${addr.diag.hadBilling + addr.diag.hadShipping} of ${contactIdsForAddr.length} contacts had an address in Zoho)${addr.diag.example ? ` e.g. "${addr.diag.example}"` : ""}`
    );
    if (addr.skipped > 0) {
      counts.warnings.push(
        `Addresses: ${addr.skipped} remaining (time budget) — click Sync again.`
      );
    }
    // Mirror detail-only contact fields (credit_limit/payment_terms/gstin/city)
    if (addr.credit.length > 0) {
      try {
        await sb.from("zoho_contacts").upsert(
          addr.credit.map((c) => ({ team_id: integration.team_id, ...c })),
          { onConflict: "team_id,zoho_contact_id" }
        );
      } catch (e) {
        counts.warnings.push(`Mirror credit skipped: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const { data: refreshedLeads } = await sb
    .from("leads")
    .select("id, zoho_customer_id")
    .eq("team_id", integration.team_id)
    .not("zoho_customer_id", "is", null);
  const customerToLead = new Map(
    (refreshedLeads ?? []).map((l) => [l.zoho_customer_id as string, l.id])
  );

  // ---- Items -> opportunity_templates ----
  const items = await fetchAll<ZohoItem>(integration, "/items", "items", sinceFilter);
  const itemRows = items.map((it) => ({
    team_id: integration.team_id,
    zoho_item_id: it.item_id,
    name: it.name,
    sku: it.sku ?? null,
    rate: it.rate ?? null,
    cost_price: it.purchase_rate ?? null,
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
      ...sinceFilter,
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

    // Incremental fetch — only fetch estimates that don't yet have value_excl_tax > 0
    const estsWithTax = new Set(
      (existingQuotes ?? [])
        .filter((q) => {
          const v = q.value_excl_tax;
          return v != null && Number(v) > 0;
        })
        .map((q) => q.zoho_estimate_id as string)
    );
    void quotesWithTax; // legacy local, unused
    const estIdsNeedingDetail = estimates
      .filter((e) => {
        const isCurrentMonth = (toDateOrNull(e.date) ?? "") >= CURRENT_MONTH_START;
        return !estsWithTax.has(e.estimate_id) || isCurrentMonth;
      })
      .sort((a, b) => {
        const aCM = (toDateOrNull(a.date) ?? "") >= CURRENT_MONTH_START ? 0 : 1;
        const bCM = (toDateOrNull(b.date) ?? "") >= CURRENT_MONTH_START ? 0 : 1;
        return aCM - bCM;
      })
      .map((e) => e.estimate_id);

    const estDetail = await fetchTaxBreakdowns(integration, "estimates", estIdsNeedingDetail, {
      deadlineMs: DETAIL_DEADLINE,
    });
    if (estDetail.skipped > 0) {
      counts.warnings.push(
        `Estimate tax: ${estDetail.skipped} skipped (time budget) — click Sync again.`
      );
    }
    counts.warnings.push(
      `Estimate details: ${estDetail.succeeded}/${estDetail.attempted} ok, ${estDetail.failed} failed`
    );
    if (estDetail.errors.length > 0) {
      counts.warnings.push(`Est errors: ${estDetail.errors.join(" | ")}`);
    }
    // Returns fresh detail-fetched tax if available, else undefined
    // (so we don't null-out previously populated values).
    const estTaxFor = (est: ZohoEstimate) => {
      const detail = estDetail.map.get(est.estimate_id);
      if (detail && (detail.sub_total > 0 || detail.tax_total > 0)) return detail;
      if ((est.sub_total ?? 0) > 0 || (est.tax_total ?? 0) > 0) {
        return { sub_total: est.sub_total ?? 0, tax_total: est.tax_total ?? 0 };
      }
      return undefined;
    };

    const quoteRows = estimates.map((est) => {
      const tax = estTaxFor(est);
      const row: Record<string, unknown> = {
        team_id: integration.team_id,
        lead_id: customerToLead.get(est.customer_id) ?? null,
        zoho_estimate_id: est.estimate_id,
        number: est.estimate_number,
        status: est.status,
        value: est.total,
        currency: est.currency_code ?? null,
        date: toDateOrNull(est.date),
        expiry_date: toDateOrNull(est.expiry_date),
        customer_id: est.customer_id,
        customer_name: est.customer_name,
        zoho_salesperson_id: est.salesperson_id ?? null,
        zoho_salesperson_name: est.salesperson_name ?? null,
        owner_id:
          quoteOwnerMap.get(est.estimate_id) ?? resolveOwner(est.salesperson_name, defaultOwner),
      };
      if (tax) {
        row.value_excl_tax = tax.sub_total;
        row.tax_amount = tax.tax_total;
      }
      return row;
    });

    {
      const withTax = quoteRows.filter(
        (r) => (r as { value_excl_tax?: unknown }).value_excl_tax !== undefined
      );
      const withoutTax = quoteRows.filter(
        (r) => (r as { value_excl_tax?: unknown }).value_excl_tax === undefined
      );
      if (withoutTax.length > 0) {
        const { error } = await sb
          .from("quotes")
          .upsert(withoutTax, { onConflict: "team_id,zoho_estimate_id" });
        if (error) throw new Error(`quotes upsert (no tax) failed: ${error.message}`);
      }
      if (withTax.length > 0) {
        const { error } = await sb
          .from("quotes")
          .upsert(withTax, { onConflict: "team_id,zoho_estimate_id" });
        if (error) throw new Error(`quotes upsert (with tax) failed: ${error.message}`);
      }
      counts.quotes = quoteRows.length;
    }

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
        const row: Record<string, unknown> = {
          team_id: integration.team_id,
          lead_id: customerToLead.get(est.customer_id) ?? null,
          zoho_estimate_id: est.estimate_id,
          zoho_customer_id: est.customer_id,
          title: `${est.estimate_number} · ${est.customer_name}`,
          value: est.total,
          stage: "proposal",
          close_date: toDateOrNull(est.expiry_date) || toDateOrNull(est.date),
          probability: 50,
          zoho_salesperson_id: est.salesperson_id ?? null,
          zoho_salesperson_name: est.salesperson_name ?? null,
          owner_id: resolveOwner(est.salesperson_name, defaultOwner),
        };
        if (tax) {
          row.value_excl_tax = tax.sub_total;
          row.tax_amount = tax.tax_total;
        }
        return row;
      });

    if (proposalOppRows.length > 0) {
      const withTax = proposalOppRows.filter(
        (r) => (r as { value_excl_tax?: unknown }).value_excl_tax !== undefined
      );
      const withoutTax = proposalOppRows.filter(
        (r) => (r as { value_excl_tax?: unknown }).value_excl_tax === undefined
      );
      if (withoutTax.length > 0) {
        const { error: oppErr } = await sb
          .from("opportunities")
          .upsert(withoutTax, { onConflict: "team_id,zoho_estimate_id" });
        if (oppErr) throw new Error(`proposal opps upsert (no tax) failed: ${oppErr.message}`);
      }
      if (withTax.length > 0) {
        const { error: oppErr } = await sb
          .from("opportunities")
          .upsert(withTax, { onConflict: "team_id,zoho_estimate_id" });
        if (oppErr) throw new Error(`proposal opps upsert (with tax) failed: ${oppErr.message}`);
      }
    }
  }

  // ---- Invoices -> won opportunities (linked to proposal opp if estimate matches) ----
  const invoices = await fetchAll<ZohoInvoice>(integration, "/invoices", "invoices", {
    sort_column: "created_time",
    sort_order: "D",
    ...sinceFilter,
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
  // Incremental: only detail-fetch invoices whose existing opp has no
  // value_excl_tax > 0 yet. Stricter check (> 0 instead of !== null) handles
  // the case where Supabase returns numeric columns as strings or zeros.
  const invoicesWithTax = new Set(
    (existingOpps ?? [])
      .filter((o) => {
        if (!o.zoho_invoice_id) return false;
        const v = o.value_excl_tax;
        return v != null && Number(v) > 0;
      })
      .map((o) => o.zoho_invoice_id as string)
  );

  // Invoices that already have line items mirrored (so we don't re-detail them).
  // Without this, invoices that got tax before line-items existed would be
  // skipped forever and never backfill their items. Scoped to this window's ids.
  const windowInvoiceIds = invoices.map((inv) => inv.invoice_id);
  const { data: itemedRows } = await sb
    .from("zoho_invoice_items")
    .select("zoho_invoice_id")
    .eq("team_id", integration.team_id)
    .in("zoho_invoice_id", windowInvoiceIds.length ? windowInvoiceIds : ["_none_"]);
  const invoicesWithItems = new Set((itemedRows ?? []).map((r) => r.zoho_invoice_id as string));

  // Needs detail if: missing tax yet, OR it's in the current month
  // (always re-fetched fresh to correct any stale value). Current-month
  // invoices are sorted first so they always complete within the budget.
  const invIdsNeedingDetail = invoices
    .filter((inv) => {
      const isCurrentMonth = (toDateOrNull(inv.date) ?? "") >= CURRENT_MONTH_START;
      return (
        !invoicesWithTax.has(inv.invoice_id) ||
        !invoicesWithItems.has(inv.invoice_id) ||
        isCurrentMonth
      );
    })
    .sort((a, b) => {
      const aCM = (toDateOrNull(a.date) ?? "") >= CURRENT_MONTH_START ? 0 : 1;
      const bCM = (toDateOrNull(b.date) ?? "") >= CURRENT_MONTH_START ? 0 : 1;
      return aCM - bCM;
    })
    .map((inv) => inv.invoice_id);

  // Time-budgeted (not count-capped): fetch as many as fit before the
  // 45s deadline. A normal month finishes in one run; only a full-history
  // backfill leaves a remainder for the next Sync click.
  const invDetail = await fetchTaxBreakdowns(integration, "invoices", invIdsNeedingDetail, {
    deadlineMs: DETAIL_DEADLINE,
  });
  if (invDetail.skipped > 0) {
    counts.warnings.push(
      `Tax backfill: ${invDetail.skipped} invoices remaining (time budget) — click Sync again to continue.`
    );
  }
  counts.warnings.push(
    `Invoice details: ${invDetail.succeeded}/${invDetail.attempted} ok, ${invDetail.failed} failed`
  );
  if (invDetail.errors.length > 0) {
    counts.warnings.push(`Inv errors: ${invDetail.errors.join(" | ")}`);
  }
  // Returns the fresh detail-fetched tax if available, else undefined
  // (so we don't overwrite previously-populated DB values with NULL).
  const invTaxFor = (inv: ZohoInvoice) => {
    const detail = invDetail.map.get(inv.invoice_id);
    const hasTax = detail && (detail.sub_total > 0 || detail.tax_total > 0);
    const tax = hasTax
      ? { sub_total: detail.sub_total, tax_total: detail.tax_total }
      : (inv.sub_total ?? 0) > 0 || (inv.tax_total ?? 0) > 0
        ? { sub_total: inv.sub_total ?? 0, tax_total: inv.tax_total ?? 0 }
        : undefined;
    // Always prefer detail values for balance/due_date/status — list endpoint
    // often returns stale or missing balance.
    const balance = detail?.balance !== undefined ? detail.balance : (inv.balance ?? null);
    const due_date = detail?.due_date !== undefined ? detail.due_date : toDateOrNull(inv.due_date);
    const invoice_status = detail?.invoice_status ?? inv.status ?? null;
    return tax ? { ...tax, balance, due_date, invoice_status } : { sub_total: 0, tax_total: 0, balance, due_date, invoice_status };
  };

  // Pass 1: for invoices with an estimate_id, update the existing proposal opp -> won
  const linkedInvoiceIds = new Set<string>();
  for (const inv of invoices) {
    if (!inv.estimate_id) continue;
    const existingOppId = oppIdByEstimate.get(inv.estimate_id);
    if (!existingOppId) continue;
    linkedInvoiceIds.add(inv.invoice_id);
    const tax = invTaxFor(inv);
    const stage = invoiceStageFor(tax.invoice_status ?? inv.status);
    const updatePayload: Record<string, unknown> = {
      zoho_invoice_id: inv.invoice_id,
      zoho_customer_id: inv.customer_id,
      title: `${inv.invoice_number} · ${inv.customer_name}`,
      value: inv.total,
      stage,
      close_date: toDateOrNull(inv.date),
      due_date: tax.due_date ?? toDateOrNull(inv.due_date),
      balance_due: tax.balance ?? null,
      invoice_status: tax.invoice_status ?? null,
      probability: stage === "won" ? 100 : stage === "lost" ? 0 : 50,
      zoho_salesperson_id: inv.salesperson_id ?? null,
      zoho_salesperson_name: inv.salesperson_name ?? null,
    };
    const resolvedOwner = inv.salesperson_name
      ? salespersonToMember.get(inv.salesperson_name) ?? null
      : null;
    if (resolvedOwner) updatePayload.owner_id = resolvedOwner;
    if (tax.sub_total > 0 || tax.tax_total > 0) {
      updatePayload.value_excl_tax = tax.sub_total;
      updatePayload.tax_amount = tax.tax_total;
    }
    await sb.from("opportunities").update(updatePayload).eq("id", existingOppId);
  }

  // Pass 2: invoices without a linked estimate -> upsert new won opp by invoice id
  const unlinkedInvoices = invoices.filter((inv) => !linkedInvoiceIds.has(inv.invoice_id));
  const oppRows = unlinkedInvoices.map((inv) => {
    const tax = invTaxFor(inv);
    const stage = invoiceStageFor(tax.invoice_status ?? inv.status);
    const row: Record<string, unknown> = {
      team_id: integration.team_id,
      lead_id: customerToLead.get(inv.customer_id) ?? null,
      zoho_invoice_id: inv.invoice_id,
      zoho_customer_id: inv.customer_id,
      title: `${inv.invoice_number} · ${inv.customer_name}`,
      value: inv.total,
      stage,
      close_date: toDateOrNull(inv.date),
      due_date: tax.due_date ?? toDateOrNull(inv.due_date),
      balance_due: tax.balance ?? null,
      invoice_status: tax.invoice_status ?? null,
      probability: stage === "won" ? 100 : stage === "lost" ? 0 : 50,
      zoho_salesperson_id: inv.salesperson_id ?? null,
      zoho_salesperson_name: inv.salesperson_name ?? null,
      owner_id:
        oppOwnerMapByInv.get(inv.invoice_id) ?? resolveOwner(inv.salesperson_name, defaultOwner),
    };
    if (tax.sub_total > 0 || tax.tax_total > 0) {
      row.value_excl_tax = tax.sub_total;
      row.tax_amount = tax.tax_total;
    }
    return row;
  });
  if (oppRows.length > 0) {
    // Split: rows with fresh tax data get those columns; rows without
    // omit them entirely so existing populated tax stays intact during
    // bulk ON CONFLICT DO UPDATE.
    const withTax = oppRows.filter(
      (r) => (r as { value_excl_tax?: unknown }).value_excl_tax !== undefined
    );
    const withoutTax = oppRows.filter(
      (r) => (r as { value_excl_tax?: unknown }).value_excl_tax === undefined
    );
    if (withoutTax.length > 0) {
      const { error } = await sb
        .from("opportunities")
        .upsert(withoutTax, { onConflict: "team_id,zoho_invoice_id" });
      if (error) throw new Error(`opps upsert (no tax) failed: ${error.message}`);
    }
    if (withTax.length > 0) {
      const { error } = await sb
        .from("opportunities")
        .upsert(withTax, { onConflict: "team_id,zoho_invoice_id" });
      if (error) throw new Error(`opps upsert (with tax) failed: ${error.message}`);
    }
  }
  counts.invoices = invoices.length;

  // ---- Mirror: zoho_invoices + zoho_invoice_items (line-item cache for the portal) ----
  try {
    const nowIso = new Date().toISOString();
    const invoiceMirror = invoices.map((inv) => {
      const d = invDetail.map.get(inv.invoice_id);
      return {
        team_id: integration.team_id,
        zoho_invoice_id: inv.invoice_id,
        invoice_number: inv.invoice_number ?? null,
        zoho_contact_id: inv.customer_id ?? null,
        date: toDateOrNull(inv.date),
        due_date: d?.due_date ?? toDateOrNull(inv.due_date),
        status: d?.invoice_status ?? inv.status ?? null,
        sub_total: d?.sub_total ?? inv.sub_total ?? null,
        tax_total: d?.tax_total ?? inv.tax_total ?? null,
        total: inv.total ?? null,
        balance: d?.balance ?? inv.balance ?? null,
        synced_at: nowIso,
      };
    });
    if (invoiceMirror.length > 0) {
      await sb.from("zoho_invoices").upsert(invoiceMirror, { onConflict: "team_id,zoho_invoice_id" });
    }

    // Line items: only for invoices detail-fetched THIS run (others keep their
    // rows). Replace each such invoice's items wholesale to handle line edits.
    const detailedIds = invoices
      .map((inv) => inv.invoice_id)
      .filter((id) => invDetail.map.get(id)?.line_items);
    if (detailedIds.length > 0) {
      const itemRows: Record<string, unknown>[] = [];
      for (const invId of detailedIds) {
        for (const li of invDetail.map.get(invId)?.line_items ?? []) {
          itemRows.push({
            team_id: integration.team_id,
            zoho_invoice_id: invId,
            line_item_id: li.line_item_id,
            zoho_item_id: li.item_id ?? null,
            sku: li.sku ?? null,
            name: li.name ?? null,
            description: li.description ?? null,
            quantity: li.quantity ?? null,
            unit: li.unit ?? null,
            rate: li.rate ?? null,
            amount: li.item_total ?? null,
            tax_percentage: li.tax_percentage ?? null,
          });
        }
      }
      await sb
        .from("zoho_invoice_items")
        .delete()
        .eq("team_id", integration.team_id)
        .in("zoho_invoice_id", detailedIds);
      if (itemRows.length > 0) {
        await sb.from("zoho_invoice_items").insert(itemRows);
      }
    }
  } catch (e) {
    counts.warnings.push(`Mirror invoices skipped: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ---- Expenses (Zoho Books → zoho_expenses) ----
  try {
    const expenses = await fetchAll<ZohoExpense>(integration, "/expenses", "expenses", {
      sort_column: "date",
      sort_order: "D",
      ...sinceFilter,
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

  // ---- Customer payments (Zoho Books → zoho_payments + allocations) ----
  // Requires the ZohoBooks.customerpayments.READ scope. If it isn't granted yet
  // Zoho returns an auth error → we catch and skip (reconnect Zoho to enable).
  try {
    const payments = await fetchAll<ZohoPayment>(integration, "/customerpayments", "customerpayments", {
      sort_column: "date",
      sort_order: "D",
      ...sinceFilter,
    });
    if (payments.length > 0) {
      const paymentRows = payments.map((p) => ({
        team_id: integration.team_id,
        zoho_payment_id: p.payment_id,
        zoho_contact_id: p.customer_id ?? null,
        date: toDateOrNull(p.date),
        amount: p.amount ?? null,
        payment_mode: p.payment_mode ?? null,
        reference_number: p.reference_number ?? null,
        synced_at: new Date().toISOString(),
      }));
      await sb.from("zoho_payments").upsert(paymentRows, { onConflict: "team_id,zoho_payment_id" });

      // Per-invoice allocations. The LIST endpoint omits invoices[], so
      // detail-fetch /customerpayments/{id} for payments missing allocations
      // (budgeted/resumable — shares the 45s detail deadline; runs after the
      // invoice backfill has consumed its budget, i.e. over a few Sync clicks).
      const paymentIds = payments.map((p) => p.payment_id);
      const { data: haveAllocRows } = await sb
        .from("zoho_payment_allocations")
        .select("zoho_payment_id")
        .eq("team_id", integration.team_id)
        .in("zoho_payment_id", paymentIds);
      const haveAlloc = new Set((haveAllocRows ?? []).map((r) => r.zoho_payment_id as string));

      let allocCount = 0;
      const listAlloc: Record<string, unknown>[] = [];
      const needDetail: string[] = [];
      for (const p of payments) {
        if (p.invoices && p.invoices.length > 0) {
          for (const inv of p.invoices) {
            listAlloc.push({
              team_id: integration.team_id,
              zoho_payment_id: p.payment_id,
              zoho_invoice_id: inv.invoice_id,
              invoice_number: inv.invoice_number ?? null,
              amount_applied: inv.amount_applied ?? null,
            });
          }
        } else if (!haveAlloc.has(p.payment_id)) {
          needDetail.push(p.payment_id);
        }
      }
      if (listAlloc.length > 0) {
        const ids = [...new Set(listAlloc.map((r) => r.zoho_payment_id as string))];
        await sb.from("zoho_payment_allocations").delete().eq("team_id", integration.team_id).in("zoho_payment_id", ids);
        await sb.from("zoho_payment_allocations").insert(listAlloc);
        allocCount += listAlloc.length;
      }

      let payProcessed = 0;
      for (let i = 0; i < needDetail.length; i += 3) {
        if (Date.now() > DETAIL_DEADLINE) break;
        const batch = needDetail.slice(i, i + 3);
        const results = await Promise.all(
          batch.map(async (pid) => {
            try {
              const res = await zohoFetch<{
                payment?: { invoices?: { invoice_id: string; invoice_number?: string; amount_applied?: number }[] };
              }>(integration, `/customerpayments/${pid}`);
              return { pid, invoices: res.payment?.invoices ?? [] };
            } catch {
              return { pid, invoices: [] as { invoice_id: string; invoice_number?: string; amount_applied?: number }[] };
            }
          })
        );
        const rows: Record<string, unknown>[] = [];
        for (const r of results) {
          for (const inv of r.invoices) {
            rows.push({
              team_id: integration.team_id,
              zoho_payment_id: r.pid,
              zoho_invoice_id: inv.invoice_id,
              invoice_number: inv.invoice_number ?? null,
              amount_applied: inv.amount_applied ?? null,
            });
          }
        }
        if (rows.length > 0) await sb.from("zoho_payment_allocations").insert(rows);
        allocCount += rows.length;
        payProcessed = i + batch.length;
      }
      const payRemaining = needDetail.length - payProcessed;
      counts.warnings.push(
        `Payments: ${paymentRows.length} synced (${allocCount} allocations${payRemaining > 0 ? `, ${payRemaining} remaining — click Sync again` : ""})`
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    counts.warnings.push(`Payments skipped (grant ZohoBooks.customerpayments.READ + reconnect Zoho): ${msg}`);
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
