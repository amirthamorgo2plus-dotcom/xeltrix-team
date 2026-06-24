import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarginCalculatorClient } from "./margin-calculator-client";

export default async function MarginCalculatorPage() {
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const supabase = await createClient();
  const [{ data: templates }, { data: customers }, { data: priceLists }, { data: referralCustomers }, { data: allOpps }] = await Promise.all([
    supabase.from("opportunity_templates").select("id, name, sku, rate, cost_price, unit").eq("team_id", teamId).eq("active", true).order("name").limit(500),
    supabase.from("leads").select("id, company_name").eq("team_id", teamId).order("company_name").limit(500),
    supabase.from("customer_price_lists").select("lead_id, item_id, custom_rate").eq("team_id", teamId),
    supabase.from("lead_referrers").select("lead_id, referrer_id, traded_pct, manufactured_pct, default_pct, first_invoice_pct, referrers(name)").eq("team_id", teamId),
    // Opportunity titles ("INVOICE# · CUSTOMER NAME") — reliable customer list when leads table is RLS-restricted
    supabase.from("opportunities").select("lead_id, title").eq("team_id", teamId).not("lead_id", "is", null).limit(3000),
  ]);

  // Build customer list: prefer leads table; fall back to opportunity titles
  const custMap = new Map<string, string>();
  for (const c of customers ?? []) {
    if (c.company_name) custMap.set(c.id, c.company_name);
  }
  for (const opp of allOpps ?? []) {
    if (!opp.lead_id || custMap.has(opp.lead_id)) continue;
    const nameFromTitle = opp.title?.split("·")[1]?.trim();
    if (nameFromTitle) custMap.set(opp.lead_id, nameFromTitle);
  }
  const customerRows = [...custMap.entries()]
    .map(([id, company_name]) => ({ id, company_name }))
    .sort((a, b) => a.company_name.localeCompare(b.company_name));

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
          />
        </CardContent>
      </Card>
    </div>
  );
}
