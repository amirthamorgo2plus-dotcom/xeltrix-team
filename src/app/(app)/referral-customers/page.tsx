import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { LinkCustomerForm } from "./link-customer-form";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default async function ReferralCustomersPage() {
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const supabase = await createClient();

  const [{ data: links }, { data: referrers }, { data: leads }, { data: commissions }] = await Promise.all([
    supabase
      .from("lead_referrers")
      .select("id, lead_id, referrer_id, default_commission_pct, first_commission_pct, traded_commission_pct, manufactured_commission_pct, first_invoice_used, active, notes")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    supabase.from("referrers").select("id, name").eq("team_id", teamId).order("name"),
    supabase.from("leads").select("id, name, phone").eq("team_id", teamId).order("name"),
    supabase.from("referrer_commissions").select("lead_id, commission_amount, status").eq("team_id", teamId),
  ]);

  const referrerMap = new Map((referrers ?? []).map((r) => [r.id, r.name]));
  const leadMap = new Map((leads ?? []).map((l) => [l.id, { name: l.name, phone: l.phone }]));

  // Commission totals per lead
  const leadCommMap = new Map<string, { pending: number; paid: number }>();
  for (const c of commissions ?? []) {
    const prev = leadCommMap.get(c.lead_id) ?? { pending: 0, paid: 0 };
    if (c.status === "paid") prev.paid += Number(c.commission_amount ?? 0);
    else if (c.status === "pending") prev.pending += Number(c.commission_amount ?? 0);
    leadCommMap.set(c.lead_id, prev);
  }

  // Leads not yet linked
  const linkedLeadIds = new Set((links ?? []).map((l) => l.lead_id));
  const unlinkedLeads = (leads ?? []).filter((l) => !linkedLeadIds.has(l.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Referral Customers</h1>
        <p className="text-sm text-zinc-500">Customers who were referred by someone. Track their commission structure.</p>
      </div>

      <LinkCustomerForm
        teamId={teamId}
        leads={unlinkedLeads}
        referrers={referrers ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle>{links?.length ?? 0} referral customer{links?.length !== 1 ? "s" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {!links || links.length === 0 ? (
            <EmptyState title="No referral customers yet" hint="Link a customer to a referrer above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Referrer</th>
                    <th className="pb-2 pr-3 text-center">Default %</th>
                    <th className="pb-2 pr-3 text-center">1st Invoice %</th>
                    <th className="pb-2 pr-3 text-center">Traded %</th>
                    <th className="pb-2 pr-3 text-center">Xeltrix %</th>
                    <th className="pb-2 pr-4 text-center">1st Used?</th>
                    <th className="pb-2 pr-4 text-right">Pending</th>
                    <th className="pb-2 text-right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {(links ?? []).map((lk) => {
                    const lead = leadMap.get(lk.lead_id);
                    const comm = leadCommMap.get(lk.lead_id) ?? { pending: 0, paid: 0 };
                    return (
                      <tr key={lk.id} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-zinc-100">{lead?.name ?? lk.lead_id}</p>
                          {lead?.phone && <p className="text-xs text-zinc-500">{lead.phone}</p>}
                        </td>
                        <td className="py-3 pr-4 text-[#b5c76a] font-medium">
                          {referrerMap.get(lk.referrer_id) ?? "—"}
                        </td>
                        <td className="py-3 pr-3 text-center">
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                            {lk.default_commission_pct}%
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-center">
                          {lk.first_commission_pct != null ? (
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                              {lk.first_commission_pct}%
                            </span>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 pr-3 text-center">
                          {lk.traded_commission_pct != null ? (
                            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-400">
                              {lk.traded_commission_pct}%
                            </span>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 pr-3 text-center">
                          {lk.manufactured_commission_pct != null ? (
                            <span className="rounded-full bg-[#b5c76a]/10 px-2 py-0.5 text-xs text-[#b5c76a]">
                              {lk.manufactured_commission_pct}%
                            </span>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 pr-4 text-center text-xs">
                          {lk.first_commission_pct != null ? (
                            lk.first_invoice_used
                              ? <span className="text-zinc-500">✅ Used</span>
                              : <span className="text-amber-400">⬜ Pending</span>
                          ) : <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {comm.pending > 0
                            ? <span className="font-semibold text-amber-400">{fmt(comm.pending)}</span>
                            : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-3 text-right tabular-nums text-zinc-400">
                          {comm.paid > 0 ? fmt(comm.paid) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
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
