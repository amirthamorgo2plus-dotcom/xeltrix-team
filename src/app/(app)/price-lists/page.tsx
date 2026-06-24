import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { CsvUpload } from "./csv-upload";
import { PriceListTable } from "./price-list-table";

export default async function PriceListsPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string }>;
}) {
  const sp = await searchParams;
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const supabase = await createClient();

  const [{ data: customers }, { data: templates }] = await Promise.all([
    supabase.from("leads").select("id, company_name").eq("team_id", teamId).order("company_name").limit(500),
    supabase.from("opportunity_templates").select("id, name, sku, rate, unit").eq("team_id", teamId).eq("active", true).order("name").limit(500),
  ]);

  const selectedCustomerId = sp.customer_id ?? customers?.[0]?.id ?? null;

  let priceLists: Array<{ id: string; item_id: string; custom_rate: number; note: string | null }> = [];
  if (selectedCustomerId) {
    const { data } = await supabase
      .from("customer_price_lists")
      .select("id, item_id, custom_rate, note")
      .eq("team_id", teamId)
      .eq("lead_id", selectedCustomerId);
    priceLists = data ?? [];
  }

  const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer Price Lists</h1>
        <p className="text-sm text-zinc-500">
          Set custom selling rates for specific customers. Bulk upload via CSV.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Customer selector */}
        <Card className="md:w-64 shrink-0">
          <CardHeader>
            <CardTitle className="text-sm">Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="max-h-[60vh] overflow-y-auto">
              {(customers ?? []).map((c) => (
                <li key={c.id}>
                  <a
                    href={`/price-lists?customer_id=${c.id}`}
                    className={`block px-4 py-2.5 text-sm transition-colors hover:bg-zinc-800 ${
                      c.id === selectedCustomerId ? "text-[#b5c76a] bg-[#b5c76a]/10 font-medium" : "text-zinc-300"
                    }`}
                  >
                    {c.company_name}
                  </a>
                </li>
              ))}
              {(!customers || customers.length === 0) && (
                <li className="px-4 py-3 text-xs text-zinc-500">No customers yet</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Right panel */}
        <div className="flex-1 flex flex-col gap-4">
          {selectedCustomer ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{selectedCustomer.company_name} — Custom Prices</CardTitle>
                    <CsvUpload
                      teamId={teamId}
                      leadId={selectedCustomerId!}
                      templates={templates ?? []}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-xs text-zinc-500">
                    CSV format: <code className="bg-zinc-800 px-1 py-0.5 rounded">sku,custom_rate,note</code> — header row required. Items not matched by SKU are shown as warnings.
                  </p>
                  {priceLists.length === 0 ? (
                    <EmptyState
                      title="No custom prices yet"
                      hint="Upload a CSV or add prices individually below."
                    />
                  ) : (
                    <PriceListTable
                      rows={priceLists}
                      templates={templates ?? []}
                      teamId={teamId}
                      leadId={selectedCustomerId!}
                    />
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmptyState title="Select a customer" hint="Pick a customer on the left to view or upload their price list." />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
