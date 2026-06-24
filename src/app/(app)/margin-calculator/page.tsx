import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamSettings } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarginCalculatorClient } from "./margin-calculator-client";

// Company origin (Xeltrix Chemicals, Ganapathy, Coimbatore) — used for delivery distance.
const DEFAULT_ORIGIN = { lat: 11.051, lng: 76.993 };
const DEFAULT_DELIVERY = { base: 0, perKm: 15, roadFactor: 1.3 };

export default async function MarginCalculatorPage() {
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const supabase = await createClient();
  const [{ data: templates }, { data: customers }, { data: priceLists }, { data: referralCustomers }, { data: allOpps }, { data: referrersList }, settings] = await Promise.all([
    supabase.from("opportunity_templates").select("id, name, sku, rate, cost_price, unit").eq("team_id", teamId).eq("active", true).order("name").limit(500),
    // leads table: columns are id, name (NOT company_name), latitude, longitude
    supabase.from("leads").select("id, name, latitude, longitude").eq("team_id", teamId).order("name").limit(2000),
    supabase.from("customer_price_lists").select("lead_id, item_id, custom_rate").eq("team_id", teamId),
    supabase.from("lead_referrers").select("lead_id, referrer_id, traded_pct, manufactured_pct, default_pct, first_invoice_pct, referrers(name)").eq("team_id", teamId),
    // Opportunity titles ("INVOICE# · CUSTOMER NAME") — supplements customers without a leads row
    supabase.from("opportunities").select("lead_id, title").eq("team_id", teamId).not("lead_id", "is", null).limit(3000),
    // Referrers list for the "Referred by" dropdown
    supabase.from("referrers").select("id, name, default_pct, traded_pct, manufactured_pct, first_invoice_pct").eq("team_id", teamId).order("name"),
    getTeamSettings(),
  ]);

  // Build customer list + coordinate map from leads, supplemented by opportunity titles
  const custMap = new Map<string, string>();
  const coordsByLead: Record<string, { lat: number; lng: number }> = {};
  for (const c of customers ?? []) {
    if (c.name) custMap.set(c.id, c.name);
    const lat = c.latitude != null ? Number(c.latitude) : null;
    const lng = c.longitude != null ? Number(c.longitude) : null;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      coordsByLead[c.id] = { lat, lng };
    }
  }
  for (const opp of allOpps ?? []) {
    if (!opp.lead_id || custMap.has(opp.lead_id)) continue;
    const nameFromTitle = opp.title?.split("·")[1]?.trim();
    if (nameFromTitle) custMap.set(opp.lead_id, nameFromTitle);
  }
  const customerRows = [...custMap.entries()]
    .map(([id, company_name]) => ({ id, company_name }))
    .sort((a, b) => a.company_name.localeCompare(b.company_name));

  const cfg = (settings ?? {}) as { origin_lat?: number; origin_lng?: number; delivery_base?: number; delivery_per_km?: number; delivery_road_factor?: number };
  const origin = { lat: cfg.origin_lat ?? DEFAULT_ORIGIN.lat, lng: cfg.origin_lng ?? DEFAULT_ORIGIN.lng };
  const delivery = {
    base: cfg.delivery_base ?? DEFAULT_DELIVERY.base,
    perKm: cfg.delivery_per_km ?? DEFAULT_DELIVERY.perKm,
    roadFactor: cfg.delivery_road_factor ?? DEFAULT_DELIVERY.roadFactor,
  };

  const referralRows = (referralCustomers ?? []).map((r) => ({
    lead_id: r.lead_id,
    referrer_id: r.referrer_id,
    referrer_name: ((r.referrers as unknown) as { name?: string } | null)?.name ?? null,
    traded_pct: r.traded_pct,
    manufactured_pct: r.manufactured_pct,
    default_pct: r.default_pct,
    first_invoice_pct: r.first_invoice_pct,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Margin Calculator</h1>
        <p className="text-sm text-zinc-500">
          Simulate a multi-item order. See gross margin and net margin after referral commission.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Simulate Order</CardTitle>
        </CardHeader>
        <CardContent>
          <MarginCalculatorClient
            templates={templates ?? []}
            customers={customerRows}
            priceLists={priceLists ?? []}
            referralCustomers={referralRows}
            referrers={referrersList ?? []}
            coordsByLead={coordsByLead}
            origin={origin}
            delivery={delivery}
          />
        </CardContent>
      </Card>
    </div>
  );
}
