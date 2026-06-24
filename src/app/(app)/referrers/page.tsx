import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ReferrerForm } from "./referrer-form";

export default async function ReferrersPage() {
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const supabase = await createClient();

  const { data: referrers } = await supabase
    .from("referrers")
    .select("id, name, phone, email, bank_details, default_pct, traded_pct, manufactured_pct, first_invoice_pct, created_at")
    .eq("team_id", teamId)
    .order("name");

  // Commission summary per referrer
  const { data: commSummary } = await supabase
    .from("referrer_commissions")
    .select("referrer_id, commission_amount, status")
    .eq("team_id", teamId);

  const summaryMap = new Map<string, { pending: number; paid: number }>();
  for (const c of commSummary ?? []) {
    const prev = summaryMap.get(c.referrer_id) ?? { pending: 0, paid: 0 };
    if (c.status === "paid") prev.paid += Number(c.commission_amount ?? 0);
    else if (c.status === "pending") prev.pending += Number(c.commission_amount ?? 0);
    summaryMap.set(c.referrer_id, prev);
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Referrers</h1>
        <p className="text-sm text-zinc-500">People who refer customers to you. Track commission owed and paid.</p>
      </div>

      <ReferrerForm teamId={teamId} />

      <Card>
        <CardHeader>
          <CardTitle>{referrers?.length ?? 0} referrer{referrers?.length !== 1 ? "s" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {!referrers || referrers.length === 0 ? (
            <EmptyState title="No referrers yet" hint="Add your first referrer above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2 pr-4 text-center">Default %</th>
                    <th className="pb-2 pr-4 text-center">Traded %</th>
                    <th className="pb-2 pr-4 text-center">Mfg %</th>
                    <th className="pb-2 pr-4 text-center">1st Inv %</th>
                    <th className="pb-2 pr-4 text-right">Pending</th>
                    <th className="pb-2 text-right">Paid to Date</th>
                  </tr>
                </thead>
                <tbody>
                  {referrers.map((r) => {
                    const s = summaryMap.get(r.id) ?? { pending: 0, paid: 0 };
                    return (
                      <tr key={r.id} className="border-t border-zinc-800">
                        <td className="py-3 pr-4 font-medium text-zinc-100">
                          <a href={`/referrers/${r.id}`} className="hover:text-[#b5c76a] transition-colors">
                            {r.name}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{r.phone || "—"}</td>
                        <td className="py-3 pr-4 text-center tabular-nums text-zinc-300">{r.default_pct != null ? `${r.default_pct}%` : "—"}</td>
                        <td className="py-3 pr-4 text-center tabular-nums text-zinc-400">{r.traded_pct != null ? `${r.traded_pct}%` : "—"}</td>
                        <td className="py-3 pr-4 text-center tabular-nums text-zinc-400">{r.manufactured_pct != null ? `${r.manufactured_pct}%` : "—"}</td>
                        <td className="py-3 pr-4 text-center tabular-nums text-zinc-400">{r.first_invoice_pct != null ? `${r.first_invoice_pct}%` : "—"}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {s.pending > 0 ? (
                            <span className="font-semibold text-amber-400">{fmt(s.pending)}</span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right tabular-nums text-zinc-400">{s.paid > 0 ? fmt(s.paid) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
