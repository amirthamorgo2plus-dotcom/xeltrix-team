import "server-only";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { zohoFetch, getIntegrationForTeam } from "./client";
import type { IntegrationRow, ZohoContact, ZohoInvoice, ZohoItem } from "./types";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSbAdmin(url, srk, { auth: { persistSession: false } });
}

type SyncCounts = { customers: number; invoices: number; items: number };

async function getDefaultOwnerId(team_id: string): Promise<string | null> {
  const sb = adminClient();
  const { data } = await sb
    .from("team_members")
    .select("id, role")
    .eq("team_id", team_id)
    .eq("active", true)
    .in("role", ["admin", "manager"])
    .order("role"); // admin sorts before manager
  return data?.[0]?.id ?? null;
}

export async function syncFromZoho(integration: IntegrationRow): Promise<SyncCounts> {
  const sb = adminClient();
  const counts: SyncCounts = { customers: 0, invoices: 0, items: 0 };
  const defaultOwner = await getDefaultOwnerId(integration.team_id);

  // ---- Pull contacts (customers) -> leads ----
  let page = 1;
  for (;;) {
    const res = await zohoFetch<{ contacts: ZohoContact[] }>(integration, "/contacts", {
      query: { page, per_page: 200, contact_type: "customer" },
    });
    const list = res.contacts ?? [];
    if (list.length === 0) break;

    for (const c of list) {
      // Check if row exists so we don't trample manual owner reassignments
      const { data: existingLead } = await sb
        .from("leads")
        .select("id")
        .eq("team_id", integration.team_id)
        .eq("zoho_customer_id", c.contact_id)
        .maybeSingle();

      const leadPayload = {
        team_id: integration.team_id,
        zoho_customer_id: c.contact_id,
        name: c.contact_name || c.company_name || "(no name)",
        email: c.email ?? null,
        phone: c.phone ?? c.mobile ?? null,
        source: "zoho_books",
        status: "qualified",
        ...(existingLead ? {} : { owner_id: defaultOwner }),
      };

      await sb
        .from("leads")
        .upsert(leadPayload, { onConflict: "team_id,zoho_customer_id" });
      counts.customers++;
    }
    if (list.length < 200) break;
    page++;
  }

  // ---- Pull items -> opportunity_templates ----
  page = 1;
  for (;;) {
    const res = await zohoFetch<{ items: ZohoItem[] }>(integration, "/items", {
      query: { page, per_page: 200 },
    });
    const list = res.items ?? [];
    if (list.length === 0) break;

    for (const it of list) {
      await sb.from("opportunity_templates").upsert(
        {
          team_id: integration.team_id,
          zoho_item_id: it.item_id,
          name: it.name,
          sku: it.sku ?? null,
          rate: it.rate ?? null,
          unit: it.unit ?? null,
          active: (it.status ?? "active") === "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team_id,zoho_item_id" }
      );
      counts.items++;
    }
    if (list.length < 200) break;
    page++;
  }

  // ---- Pull invoices -> won opportunities ----
  page = 1;
  for (;;) {
    const res = await zohoFetch<{ invoices: ZohoInvoice[] }>(integration, "/invoices", {
      query: { page, per_page: 200, sort_column: "created_time", sort_order: "D" },
    });
    const list = res.invoices ?? [];
    if (list.length === 0) break;

    for (const inv of list) {
      // Find lead by zoho_customer_id (created by contact sync above)
      const { data: lead } = await sb
        .from("leads")
        .select("id")
        .eq("team_id", integration.team_id)
        .eq("zoho_customer_id", inv.customer_id)
        .maybeSingle();

      // Check for existing opp so we don't overwrite manual owner reassignments
      const { data: existingOpp } = await sb
        .from("opportunities")
        .select("id")
        .eq("team_id", integration.team_id)
        .eq("zoho_invoice_id", inv.invoice_id)
        .maybeSingle();

      const oppPayload = {
        team_id: integration.team_id,
        lead_id: lead?.id ?? null,
        zoho_invoice_id: inv.invoice_id,
        zoho_customer_id: inv.customer_id,
        title: `${inv.invoice_number} · ${inv.customer_name}`,
        value: inv.total,
        stage: "won",
        close_date: inv.date,
        probability: 100,
        ...(existingOpp ? {} : { owner_id: defaultOwner }),
      };

      await sb
        .from("opportunities")
        .upsert(oppPayload, { onConflict: "team_id,zoho_invoice_id" });
      counts.invoices++;
    }
    if (list.length < 200) break;
    page++;
  }

  // Update integration with success timestamp
  await sb
    .from("integrations")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: null,
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
  if (opp.zoho_invoice_id) return; // already pushed

  const integration = await getIntegrationForTeam(opp.team_id, /* useAdmin */ true);
  if (!integration?.access_token) return; // no integration; silent no-op

  // Resolve the Zoho customer (use the one stored, or look up by lead)
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
      // Create a new Zoho contact
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
      // Save back on lead for next time
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
