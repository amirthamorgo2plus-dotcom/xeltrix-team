import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { JobForm } from "./job-form";
import { PaymentToggle, ReferralToggle, DeleteJob } from "./row-actions";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default async function DeepCleaningPage() {
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const supabase = await createClient();

  const [{ data: jobs }, { data: referrers }, members] = await Promise.all([
    supabase
      .from("deep_cleaning_jobs")
      .select("id, customer_name, phone, address, service_date, description, amount, cost, payment_status, payment_mode, referrer_id, referral_pct, referral_amount, referral_status, assigned_to, notes")
      .eq("team_id", teamId)
      .order("service_date", { ascending: false }),
    supabase.from("referrers").select("id, name, default_pct").eq("team_id", teamId).order("name"),
    getTeamMembers(),
  ]);

  const referrerMap = new Map((referrers ?? []).map((r) => [r.id, r.name]));
  const memberList = (members ?? []).map((mem) => ({
    id: mem.id,
    name: (mem.profiles as { full_name?: string } | null)?.full_name ?? "Member",
  }));

  const rows = jobs ?? [];
  const totalRevenue = rows.reduce((s, j) => s + Number(j.amount ?? 0), 0);
  const totalCost = rows.reduce((s, j) => s + Number(j.cost ?? 0), 0);
  const totalMargin = totalRevenue - totalCost;
  const referralPending = rows
    .filter((j) => j.referrer_id && j.referral_status !== "paid")
    .reduce((s, j) => s + Number(j.referral_amount ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Deep Cleaning</h1>
          <p className="text-sm text-zinc-500">Non-GST service jobs recorded manually (not in Zoho). Referral paid outside Zoho.</p>
        </div>
        <JobForm teamId={teamId} referrers={referrers ?? []} members={memberList} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Revenue (non-GST)</p>
          <p className="mt-1 text-xl font-bold text-zinc-100">{fmt(totalRevenue)}</p>
          <p className="text-xs text-zinc-600">{rows.length} job{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Total Cost</p>
          <p className="mt-1 text-xl font-bold text-zinc-300">{totalCost > 0 ? fmt(totalCost) : "—"}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Margin</p>
          <p className="mt-1 text-xl font-bold text-[#b5c76a]">{totalCost > 0 ? fmt(totalMargin) : "—"}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Referral Pending</p>
          <p className="mt-1 text-xl font-bold text-amber-400">{fmt(referralPending)}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} job{rows.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No deep cleaning jobs yet" hint="Add a job to start tracking non-GST service work." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Customer</th>
                    <th className="pb-2 pr-3 text-right">Amount</th>
                    <th className="pb-2 pr-3 text-right">Margin</th>
                    <th className="pb-2 pr-3 text-center">Payment</th>
                    <th className="pb-2 pr-3">Referrer</th>
                    <th className="pb-2 pr-3 text-right">Referral</th>
                    <th className="pb-2 pr-3 text-center">Ref. paid?</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => {
                    const amount = Number(j.amount ?? 0);
                    const cost = j.cost != null ? Number(j.cost) : null;
                    const margin = cost != null ? amount - cost : null;
                    return (
                      <tr key={j.id} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 pr-3 text-zinc-400 text-xs">
                          {j.service_date ? format(parseISO(j.service_date), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-zinc-100">{j.customer_name}</p>
                          {j.description && <p className="text-xs text-zinc-500 max-w-[220px] truncate">{j.description}</p>}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">{fmt(amount)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-[#b5c76a]">{margin != null ? fmt(margin) : "—"}</td>
                        <td className="py-2.5 pr-3 text-center"><PaymentToggle id={j.id} status={j.payment_status} /></td>
                        <td className="py-2.5 pr-3 text-[#b5c76a]">{j.referrer_id ? (referrerMap.get(j.referrer_id) ?? "—") : <span className="text-zinc-600">—</span>}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {j.referrer_id && j.referral_amount != null
                            ? <span className="text-amber-400">{fmt(Number(j.referral_amount))} <span className="text-zinc-600 text-xs">({j.referral_pct}%)</span></span>
                            : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          {j.referrer_id && j.referral_amount ? <ReferralToggle id={j.id} status={j.referral_status} /> : <span className="text-zinc-700 text-xs">—</span>}
                        </td>
                        <td className="py-2.5 flex items-center gap-2">
                          <JobForm
                            teamId={teamId}
                            referrers={referrers ?? []}
                            members={memberList}
                            trigger="edit"
                            edit={{
                              id: j.id, customer_name: j.customer_name, phone: j.phone, address: j.address,
                              service_date: j.service_date, description: j.description, amount, cost,
                              payment_status: j.payment_status, payment_mode: j.payment_mode,
                              referrer_id: j.referrer_id, referral_pct: j.referral_pct, assigned_to: j.assigned_to, notes: j.notes,
                            }}
                          />
                          <DeleteJob id={j.id} />
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
