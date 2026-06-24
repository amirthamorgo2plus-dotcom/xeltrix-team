import { format, parseISO } from "date-fns";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { AddCommissionForm } from "./add-commission-form";
import { MarkPaidPanel } from "./mark-paid-panel";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const RATE_LABEL: Record<string, string> = {
  first_invoice:       "1st invoice bonus",
  traded_rate:         "Traded rate",
  manufactured_rate:   "Xeltrix rate",
  default:             "Default rate",
  manual_override:     "Manual override",
};

export default async function ReferrerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const supabase = await createClient();

  const { data: referrer } = await supabase
    .from("referrers")
    .select("id, name, phone, email, bank_details, default_pct, traded_pct, manufactured_pct, first_invoice_pct")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (!referrer) notFound();

  const { data: commissions } = await supabase
    .from("referrer_commissions")
    .select("id, lead_id, opportunity_id, invoice_amount, invoice_category, commission_pct, commission_amount, rate_reason, override_pct, override_note, status, paid_at, paid_note, created_at")
    .eq("referrer_id", id)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  // Linked customers for this referrer
  const { data: links } = await supabase
    .from("lead_referrers")
    .select("lead_id, default_commission_pct, first_commission_pct, traded_commission_pct, manufactured_commission_pct, first_invoice_used")
    .eq("referrer_id", id)
    .eq("team_id", teamId);

  const linkedLeadIds = new Set((links ?? []).map((l) => l.lead_id));

  // Leads for this referrer
  const { data: allLeads } = await supabase
    .from("leads")
    .select("id, name, phone")
    .eq("team_id", teamId)
    .order("name");

  const referralLeads = (allLeads ?? []).filter((l) => linkedLeadIds.has(l.id));

  // Invoices for those leads not yet having a commission record
  const { data: invoices } = await supabase
    .from("opportunities")
    .select("id, title, value, balance_due, close_date, zoho_salesperson_name, owner_id, lead_id")
    .eq("team_id", teamId)
    .eq("stage", "won")
    .in("lead_id", referralLeads.map((l) => l.id));

  const existingOppIds = new Set((commissions ?? []).map((c) => c.opportunity_id));
  const availableInvoices = (invoices ?? []).filter((inv) => !existingOppIds.has(inv.id));

  // Auto-detect from Zoho: won invoices where salesperson name ends with "& <referrer name>"
  const { data: zohoDetected } = await supabase
    .from("opportunities")
    .select("id, title, value, close_date, zoho_salesperson_name, lead_id")
    .eq("team_id", teamId)
    .eq("stage", "won")
    .ilike("zoho_salesperson_name", `%& ${referrer.name}`);

  // Exclude already-logged commissions
  const detectedNew = (zohoDetected ?? []).filter((inv) => !existingOppIds.has(inv.id));

  // Get lead names for detected invoices
  const detectedLeadIds = [...new Set(detectedNew.map((i) => i.lead_id).filter(Boolean))];
  const { data: detectedLeads } = detectedLeadIds.length > 0
    ? await supabase.from("leads").select("id, name, company_name").in("id", detectedLeadIds)
    : { data: [] };
  const detectedLeadMap = new Map((detectedLeads ?? []).map((l) => [l.id, l.company_name || l.name]));

  const pendingTotal = (commissions ?? []).filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount ?? 0), 0);
  const paidTotal = (commissions ?? []).filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount ?? 0), 0);
  const pendingIds = (commissions ?? []).filter((c) => c.status === "pending").map((c) => c.id);

  const leadMap = new Map((allLeads ?? []).map((l) => [l.id, l.name]));
  const linkMap = new Map((links ?? []).map((l) => [l.lead_id, l]));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <a href="/referrers" className="text-xs text-zinc-500 hover:text-zinc-300">← All Referrers</a>
        <h1 className="text-2xl font-semibold">{referrer.name}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          {referrer.phone && <span>📞 {referrer.phone}</span>}
          {referrer.email && <span>✉️ {referrer.email}</span>}
          {referrer.bank_details && <span>🏦 {referrer.bank_details}</span>}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Pending Commission</p>
          <p className="mt-1 text-xl font-bold text-amber-400">{fmt(pendingTotal)}</p>
          <p className="text-xs text-zinc-600">{(commissions ?? []).filter(c => c.status === "pending").length} invoices</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Paid to Date</p>
          <p className="mt-1 text-xl font-bold text-[#b5c76a]">{fmt(paidTotal)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Referred Customers</p>
          <p className="mt-1 text-xl font-bold text-zinc-100">{referralLeads.length}</p>
        </div>
      </div>

      {/* Mark paid */}
      {pendingIds.length > 0 && (
        <MarkPaidPanel pendingIds={pendingIds} pendingTotal={pendingTotal} />
      )}

      {/* Auto-detected from Zoho salesperson name */}
      {detectedNew.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400 font-medium">
                {detectedNew.length} detected
              </span>
              Invoices Detected from Zoho
            </CardTitle>
            <p className="text-xs text-zinc-500 mt-1">
              These won invoices have <span className="text-zinc-300">"&amp; {referrer.name}"</span> in the salesperson field — commission not yet logged.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Invoice</th>
                    <th className="pb-2 pr-4">Salesperson</th>
                    <th className="pb-2 pr-4">Close Date</th>
                    <th className="pb-2 text-right">Invoice Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedNew.map((inv) => (
                    <tr key={inv.id} className="border-t border-zinc-800 hover:bg-zinc-800/20 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-zinc-100">
                        {detectedLeadMap.get(inv.lead_id ?? "") ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-400 text-xs">{inv.title ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-zinc-500 text-xs">{inv.zoho_salesperson_name ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-zinc-500 text-xs">
                        {inv.close_date ? format(parseISO(inv.close_date), "dd MMM yyyy") : "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-semibold text-zinc-100">
                        {fmt(Number(inv.value ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700">
                    <td colSpan={4} className="pt-3 text-xs text-zinc-500">Total detected</td>
                    <td className="pt-3 text-right tabular-nums font-bold text-[#b5c76a]">
                      {fmt(detectedNew.reduce((s, i) => s + Number(i.value ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              To log commission, use <span className="text-zinc-300">"Add Commission for Invoice"</span> below — or{" "}
              <span className="text-zinc-300">link these customers</span> via Referral Customers first if not already linked.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add commission for invoice */}
      {availableInvoices.length > 0 && (
        <AddCommissionForm
          teamId={teamId}
          referrerId={id}
          invoices={availableInvoices.map((inv) => ({
            id: inv.id,
            title: inv.title ?? "—",
            value: Number(inv.value ?? 0),
            leadName: leadMap.get(inv.lead_id ?? "") ?? "Unknown",
            closeDate: inv.close_date ?? null,
          }))}
          linkMap={Object.fromEntries([...linkMap.entries()].map(([k, v]) => [
            k,
            {
              default_commission_pct: v.default_commission_pct,
              first_commission_pct: v.first_commission_pct,
              traded_commission_pct: v.traded_commission_pct,
              manufactured_commission_pct: v.manufactured_commission_pct,
              first_invoice_used: v.first_invoice_used,
            }
          ]))}
          leadIds={Object.fromEntries(referralLeads.map((l) => [l.id, l.name]))}
          invoiceLeadMap={Object.fromEntries((invoices ?? []).map((inv) => [inv.id, inv.lead_id ?? ""]))}
          referrerDefaults={{
            default_pct: referrer.default_pct ?? null,
            traded_pct: referrer.traded_pct ?? null,
            manufactured_pct: referrer.manufactured_pct ?? null,
            first_invoice_pct: referrer.first_invoice_pct ?? null,
          }}
        />
      )}

      {/* Commission records */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Records</CardTitle>
        </CardHeader>
        <CardContent>
          {!commissions || commissions.length === 0 ? (
            <EmptyState title="No commissions recorded yet" hint="Add an invoice above to start tracking." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Invoice</th>
                    <th className="pb-2 pr-4 text-right">Inv. Amount</th>
                    <th className="pb-2 pr-3 text-center">Rate</th>
                    <th className="pb-2 pr-3 text-center">Reason</th>
                    <th className="pb-2 pr-4 text-right">Commission</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 pr-4 font-medium text-zinc-200">{leadMap.get(c.lead_id) ?? "—"}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-zinc-400">{c.opportunity_id?.slice(0, 8)}…</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-300">{fmt(Number(c.invoice_amount ?? 0))}</td>
                      <td className="py-3 pr-3 text-center">
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{c.commission_pct}%</span>
                        {c.override_pct != null && (
                          <span className="ml-1 text-[10px] text-amber-400" title={c.override_note ?? ""}>✏️</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-center text-xs text-zinc-500">
                        {RATE_LABEL[c.rate_reason ?? ""] ?? c.rate_reason ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums font-semibold text-[#b5c76a]">
                        {fmt(Number(c.commission_amount ?? 0))}
                      </td>
                      <td className="py-3 pr-4">
                        {c.status === "paid" ? (
                          <span className="rounded-full bg-[#b5c76a]/10 px-2 py-0.5 text-xs text-[#b5c76a]">✅ Paid</span>
                        ) : c.status === "excluded" ? (
                          <span className="rounded-full bg-zinc-700/30 px-2 py-0.5 text-xs text-zinc-500">Excluded</span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">⬜ Pending</span>
                        )}
                      </td>
                      <td className="py-3 text-zinc-500 text-xs">
                        {c.paid_at ? format(parseISO(c.paid_at), "dd MMM yyyy") : "—"}
                        {c.paid_note && <div className="text-zinc-600">{c.paid_note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
