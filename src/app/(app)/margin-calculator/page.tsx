import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarginCalculatorClient } from "./margin-calculator-client";

export default async function MarginCalculatorPage() {
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const supabase = await createClient();
  const [{ data: templates }, { data: customers }, { data: priceLists }, { data: referralCustomers }] = await Promise.all([
    supabase.from("opportunity_templates").select("id, name, sku, rate, cost_price, unit").eq("team_id", teamId).eq("active", true).order("name").limit(500),
    supabase.from("leads").select("id, company_name").eq("team_id", teamId).order("company_name").limit(500),
    supabase.from("customer_price_lists").select("lead_id, item_id, custom_rate").eq("team_id", teamId),
    supabase.from("lead_referrers").select("lead_id, referrer_id, traded_pct, manufactured_pct, default_pct, first_invoice_pct").eq("team_id", teamId),
  ]);

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
            customers={customers ?? []}
            priceLists={priceLists ?? []}
            referralCustomers={referralCustomers ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
