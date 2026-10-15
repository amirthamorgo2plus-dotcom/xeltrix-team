import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamSettings, isAdminOrManager } from "@/lib/data";
import {
  DEFAULT_LABOUR_PER_PERSON_DAY,
  DEFAULT_TRAVEL_FLAT,
} from "@/lib/deep-cleaning-quote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteClient, type Product, type Referrer } from "./quote-client";

export default async function DeepCleaningQuotePage() {
  const me = await getMyMembership();
  if ((me as { attendance_only?: boolean } | null)?.attendance_only) {
    redirect("/attendance");
  }
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const settings = await getTeamSettings();
  const rates = settings?.deep_cleaning_rates;

  const supabase = await createClient();
  const [{ data: templates }, { data: referrers }] = await Promise.all([
    supabase
      .from("opportunity_templates")
      .select("id, name, cost_price")
      .eq("team_id", teamId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("referrers")
      .select("id, name, default_pct")
      .eq("team_id", teamId)
      .order("name"),
  ]);

  const products: Product[] = (templates ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    cost_price: t.cost_price == null ? null : Number(t.cost_price),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Deep cleaning quote</h1>
          <p className="text-sm text-zinc-500">
            What a job costs, and what to charge for it. A referral commission comes out of
            the price, so it has to be priced in rather than added on.
          </p>
        </div>
        <Link
          href="/deep-cleaning"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          All jobs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work out a price</CardTitle>
        </CardHeader>
        <CardContent>
          <QuoteClient
            products={products}
            referrers={(referrers ?? []).map((r) => ({
              id: r.id as string,
              name: r.name as string,
              default_pct: r.default_pct == null ? null : Number(r.default_pct),
            })) as Referrer[]}
            currency={settings?.currency || "INR"}
            defaultLabour={rates?.labour_per_person_day ?? DEFAULT_LABOUR_PER_PERSON_DAY}
            defaultTravel={rates?.travel_flat ?? DEFAULT_TRAVEL_FLAT}
            canSaveDefaults={isAdminOrManager(me?.role)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
