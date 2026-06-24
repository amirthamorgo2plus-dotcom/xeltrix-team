import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { LinkCustomerForm, QuickLinkButton } from "./link-customer-form";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export default async function ReferralCustomersPage() {
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const supabase = await createClient();

  const [{ data: links }, { data: referrers }, { data: commissions }, { data: wonOpps }, { data: allOpps }, { data: leadsRaw }] = await Promise.all([
    supabase
      .from("lead_referrers")
      .select("id, lead_id, referrer_id, first_invoice_used")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    supabase.from("referrers").select("id, name").eq("team_id", teamId).order("name"),
    supabase.from("referrer_commissions").select("lead_id, commission_amount, status").eq("team_id", teamId),
    supabase.from("opportunities").select("lead_id, zoho_salesperson_name, title").eq("team_id", teamId).neq("stage", "lost").ilike("zoho_salesperson_name", "%&%").limit(1000),
    // All opportunities — titles are "INVOICE# · CUSTOMER NAME", reliable source of customer names
    supabase.from("opportunities").select("lead_id, title").eq("team_id", teamId).not("lead_id", "is", null).limit(3000),
    // Direct leads query (may be RLS-restricted; used as supplement when available)
    supabase.from("leads").select("id, name, company_name, phone").eq("team_id", teamId).limit(2000),
  ]);

  // Build lead_id -> name map. Prefer leads table; fall back to opportunity title.
  const leadMap = new Map<string, { name: string; phone: string | null }>();
  for (const l of leadsRaw ?? []) {
    leadMap.set(l.id, { name: l.company_name || l.name, phone: l.phone });
  }
  for (const opp of allOpps ?? []) {
    if (!opp.lead_id || leadMap.has(opp.lead_id)) continue;
    const nameFromTitle = opp.title?.split("·")[1]?.trim();
    if (nameFromTitle) leadMap.set(opp.lead_id, { name: nameFromTitle, phone: null });
  }

  // Customer list for the dropdown — from the combined map
  const leads = [...leadMap.entries()]
    .map(([id, v]) => ({ id, name: v.name, company_name: v.name, phone: v.phone }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const referrerMap = new Map((referrers ?? []).map((r) => [r.id, r.name]));
  const referrerByName = new Map((referrers ?? []).map((r) => [r.name.toLowerCase(), r]));

  // Commission totals per lead
  const leadCommMap = new Map<string, { pending: number; paid: number }>();
  for (const c of commissions ?? []) {
    const prev = leadCommMap.get(c.lead_id) ?? { pending: 0, paid: 0 };
    if (c.status === "paid") prev.paid += Number(c.commission_amount ?? 0);
    else if (c.status === "pending") prev.pending += Number(c.commission_amount ?? 0);
    leadCommMap.set(c.lead_id, prev);
  }

  const linkedLeadIds = new Set((links ?? []).map((l) => l.lead_id));

  // Auto-detect from Zoho: parse "SomeOne & ReferrerName" → find matching referrer
  type Detected = { lead_id: string | null; leadName: string; referrerId: string; referrerName: string; salesperson: string };
  const detectedMap = new Map<string, Detected>();
  for (const opp of wonOpps ?? []) {
    const sp = opp.zoho_salesperson_name ?? "";
    const ampIdx = sp.indexOf("&");
    if (ampIdx === -1) continue;
    const afterAmp = sp.slice(ampIdx + 1).trim().toLowerCase();
    // Try exact match first, then check if any referrer name is contained
    let referrer = referrerByName.get(afterAmp);
    if (!referrer) {
      for (const [rname, r] of referrerByName) {
        if (afterAmp.includes(rname)) { referrer = r; break; }
      }
    }
    if (!referrer) continue;
    if (opp.lead_id && linkedLeadIds.has(opp.lead_id)) continue;
    const key = `${opp.lead_id ?? "null"}::${referrer.id}`;
    if (!detectedMap.has(key)) {
      const custName = opp.lead_id
        ? (leadMap.get(opp.lead_id)?.name ?? opp.title?.split("·")[1]?.trim() ?? opp.lead_id)
        : (opp.title?.split("·")[1]?.trim() ?? "Unknown customer");
      detectedMap.set(key, {
        lead_id: opp.lead_id ?? null,
        leadName: custName,
        referrerId: referrer.id,
        referrerName: referrer.name,
        salesperson: sp,
      });
    }
  }
  const detected = [...detectedMap.values()];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Referral Customers</h1>
        <p className="text-sm text-zinc-500">Customers who were referred by someone. Track their commission structure.</p>
      </div>

      <LinkCustomerForm
        teamId={teamId}
        leads={(leads ?? []).map((l) => ({ id: l.id, name: l.company_name || l.name, phone: l.phone }))}
        referrers={referrers ?? []}
      />

      {/* Auto-detected from Zoho */}
      {detected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400 font-medium">
                {detected.length} detected
              </span>
              Detected from Zoho Salesperson Names
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              These customers have <span className="text-zinc-300">"Main & Referrer"</span> in their Zoho salesperson field but haven't been linked yet. Link them to start tracking commission.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Referrer</th>
                    <th className="pb-2 pr-4">Zoho Salesperson</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {detected.map((d) => (
                    <tr key={`${d.lead_id}::${d.referrerId}`} className="border-t border-zinc-800 hover:bg-zinc-800/20 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-zinc-100">{d.leadName}</td>
                      <td className="py-2.5 pr-4 text-[#b5c76a] font-medium">{d.referrerName}</td>
                      <td className="py-2.5 pr-4 text-zinc-500 text-xs">{d.salesperson}</td>
                      <td className="py-2.5">
                        {d.lead_id ? (
                          <QuickLinkButton
                            teamId={teamId}
                            leadId={d.lead_id}
                            referrerId={d.referrerId}
                            leadName={d.leadName}
                            referrerName={d.referrerName}
                          />
                        ) : (
                          <span className="text-xs text-zinc-600">No lead record</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
                    <th className="pb-2 pr-4 text-center">1st Invoice</th>
                    <th className="pb-2 pr-4 text-right">Commission Pending</th>
                    <th className="pb-2 text-right">Commission Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {(links ?? []).map((lk) => {
                    const joined = leadMap.get(lk.lead_id);
                    const customerName = joined?.name || "—";
                    const comm = leadCommMap.get(lk.lead_id) ?? { pending: 0, paid: 0 };
                    return (
                      <tr key={lk.id} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-zinc-100">{customerName}</p>
                          {joined?.phone && <p className="text-xs text-zinc-500">{joined.phone}</p>}
                        </td>
                        <td className="py-3 pr-4">
                          <a href={`/referrers/${lk.referrer_id}`} className="text-[#b5c76a] font-medium hover:underline">
                            {referrerMap.get(lk.referrer_id) ?? "—"}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-center text-xs">
                          {lk.first_invoice_used
                            ? <span className="text-zinc-500">✅ Used</span>
                            : <span className="text-amber-400">⬜ Not yet</span>}
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
