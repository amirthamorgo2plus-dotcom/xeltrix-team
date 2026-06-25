import { format, parseISO } from "date-fns";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { AddCommissionForm } from "./add-commission-form";
import { MarkPaidPanel } from "./mark-paid-panel";
import { EditReferrerForm } from "./edit-referrer-form";
import { CommissionReportButton, type ReportRow } from "./commission-report-button";

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

  // Deep cleaning referrals for this referrer (non-GST, manual)
  const { data: deepJobs } = await supabase
    .from("deep_cleaning_jobs")
    .select("id, customer_name, service_date, amount, referral_pct, referral_amount, referral_status")
    .eq("referrer_id", id)
    .eq("team_id", teamId)
    .order("service_date", { ascending: false });

  const deepPending = (deepJobs ?? []).filter((j) => j.referral_status !== "paid").reduce((s, j) => s + Number(j.referral_amount ?? 0), 0);
  const deepPaid = (deepJobs ?? []).filter((j) => j.referral_status === "paid").reduce((s, j) => s + Number(j.referral_amount ?? 0), 0);

  // Linked customers for this referrer
  const { data: links } = await supabase
    .from("lead_referrers")
    .select("lead_id, first_invoice_used")
    .eq("referrer_id", id)
    .eq("team_id", teamId);

  const linkedLeadIds = new Set((links ?? []).map((l) => l.lead_id));

  // Only actual invoices (zoho_invoice_id set) for linked customers — excludes quotes/estimates
  const { data: invoices } = linkedLeadIds.size > 0
    ? await supabase
        .from("opportunities")
        .select("id, title, value, value_excl_tax, close_date, zoho_salesperson_name, lead_id")
        .eq("team_id", teamId)
        .not("zoho_invoice_id", "is", null)
        .in("lead_id", [...linkedLeadIds])
        .order("close_date", { ascending: false })
    : { data: [] };

  const existingOppIds = new Set((commissions ?? []).map((c) => c.opportunity_id));
  const availableInvoices = (invoices ?? []).filter((inv) => !existingOppIds.has(inv.id));

  const pendingTotal = (commissions ?? []).filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount ?? 0), 0);
  const paidTotal = (commissions ?? []).filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount ?? 0), 0);
  const pendingIds = (commissions ?? []).filter((c) => c.status === "pending").map((c) => c.id);

  // Resolve customer names from invoice titles (leads table is RLS-restricted)
  const leadMap = new Map<string, string>();
  for (const inv of invoices ?? []) {
    if (!inv.lead_id || leadMap.has(inv.lead_id)) continue;
    const nameFromTitle = inv.title?.split("·")[1]?.trim();
    if (nameFromTitle) leadMap.set(inv.lead_id, nameFromTitle);
  }
  const referralLeadMap = leadMap;
  const referralLeads = [...linkedLeadIds].map((id) => ({ id, name: leadMap.get(id) ?? "—" }));
  const linkMap = new Map((links ?? []).map((l) => [l.lead_id, l]));

  // Identify the earliest invoice per customer (by date) — that one gets the 1st-invoice %
  const firstInvoiceIdByLead = new Map<string, string>();
  {
    const earliest = new Map<string, { id: string; date: string }>();
    for (const inv of invoices ?? []) {
      if (!inv.lead_id) continue;
      const date = inv.close_date ?? "9999-12-31";
      const prev = earliest.get(inv.lead_id);
      if (!prev || date < prev.date) earliest.set(inv.lead_id, { id: inv.id, date });
    }
    for (const [lead, v] of earliest) firstInvoiceIdByLead.set(lead, v.id);
  }

  // Per-invoice commission: 1st invoice per customer → first_invoice_pct, else default_pct
  const ref = referrer!;
  function calcCommission(leadId: string, invValue: number, invId: string): { pct: number; amount: number; reason: string } {
    const isFirst = firstInvoiceIdByLead.get(leadId) === invId;
    if (isFirst && ref.first_invoice_pct != null) {
      return { pct: ref.first_invoice_pct, amount: (invValue * ref.first_invoice_pct) / 100, reason: "1st invoice" };
    }
    const pct = ref.default_pct ?? 0;
    return { pct, amount: (invValue * pct) / 100, reason: "default" };
  }

  // Rows for the downloadable PDF report
  const reportRows: ReportRow[] = (invoices ?? []).map((inv) => {
    const base = Number(inv.value_excl_tax ?? inv.value ?? 0);
    const logged = (commissions ?? []).find((c) => c.opportunity_id === inv.id);
    const comm = calcCommission(inv.lead_id ?? "", base, inv.id);
    return {
      customer: referralLeadMap.get(inv.lead_id ?? "") ?? leadMap.get(inv.lead_id ?? "") ?? "—",
      invoice: inv.title ?? "—",
      date: inv.close_date ? format(parseISO(inv.close_date), "dd MMM yyyy") : null,
      taxable: base,
      pct: logged ? Number(logged.commission_pct ?? 0) : comm.pct,
      commission: logged ? Number(logged.commission_amount ?? 0) : comm.amount,
      isFirst: !logged && comm.reason === "1st invoice",
      status: logged ? (logged.status === "paid" ? "Paid" : "Pending") : "Not logged",
    };
  });
  const generatedOn = format(new Date(), "dd MMM yyyy");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <a href="/referrers" className="text-xs text-zinc-500 hover:text-zinc-300">← All Referrers</a>
          <h1 className="text-2xl font-semibold">{referrer.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            {referrer.phone && <span>📞 {referrer.phone}</span>}
            {referrer.email && <span>✉️ {referrer.email}</span>}
            {referrer.bank_details && <span>🏦 {referrer.bank_details}</span>}
          </div>
        </div>
        <EditReferrerForm referrer={{
          id: referrer.id,
          name: referrer.name,
          phone: referrer.phone ?? "",
          email: referrer.email ?? "",
          bank_details: referrer.bank_details ?? "",
          default_pct: referrer.default_pct,
          traded_pct: referrer.traded_pct,
          manufactured_pct: referrer.manufactured_pct,
          first_invoice_pct: referrer.first_invoice_pct,
        }} />
      </div>

      {/* Commission rates strip */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Default %", value: referrer.default_pct, hint: "All items" },
          { label: "Traded %", value: referrer.traded_pct, hint: "R- items" },
          { label: "Manufactured %", value: referrer.manufactured_pct, hint: "X- / PM- / RM-" },
          { label: "1st Invoice %", value: referrer.first_invoice_pct, hint: "First order only" },
        ].map(({ label, value, hint }) => (
          <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 min-w-[110px]">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="text-lg font-bold" style={{ color: value != null ? "#b5c76a" : "#52525b" }}>
              {value != null ? `${value}%` : "—"}
            </p>
            <p className="text-[10px] text-zinc-600">{hint}</p>
          </div>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Pending (Zoho)</p>
          <p className="mt-1 text-xl font-bold text-amber-400">{fmt(pendingTotal)}</p>
          <p className="text-xs text-zinc-600">{(commissions ?? []).filter(c => c.status === "pending").length} invoices</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Pending (Deep Clean)</p>
          <p className="mt-1 text-xl font-bold text-amber-400">{fmt(deepPending)}</p>
          <p className="text-xs text-zinc-600">{(deepJobs ?? []).filter(j => j.referral_status !== "paid").length} jobs</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Paid to Date</p>
          <p className="mt-1 text-xl font-bold text-[#b5c76a]">{fmt(paidTotal + deepPaid)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Referred Customers</p>
          <p className="mt-1 text-xl font-bold text-zinc-100">{(referralLeads ?? []).length}</p>
        </div>
      </div>

      {/* Mark paid */}
      {pendingIds.length > 0 && (
        <MarkPaidPanel pendingIds={pendingIds} pendingTotal={pendingTotal} />
      )}

      {/* All invoices for referred customers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle>Referred Customer Invoices</CardTitle>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-400">
                {availableInvoices.length} not logged
              </span>
              <span className="rounded-full bg-[#b5c76a]/10 px-2 py-0.5 text-[#b5c76a]">
                {existingOppIds.size} logged
              </span>
              {reportRows.length > 0 && (
                <CommissionReportButton referrerName={referrer.name} rows={reportRows} generatedOn={generatedOn} />
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500">All won invoices for customers linked to {referrer.name}. Commission is estimated from referrer default rates.</p>
        </CardHeader>
        <CardContent>
          {(invoices ?? []).length === 0 ? (
            <EmptyState title="No invoices found" hint="Link customers to this referrer or sync Zoho to see invoices." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Invoice</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4 text-right">Taxable Amt (excl. GST)</th>
                    <th className="pb-2 pr-3 text-center">Rate</th>
                    <th className="pb-2 pr-4 text-right">Est. Commission</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoices ?? []).map((inv) => {
                    // Commission is on the pre-GST taxable value (value_excl_tax), not the GST-inclusive total
                    const invAmt = Number(inv.value_excl_tax ?? inv.value ?? 0);
                    const comm = calcCommission(inv.lead_id ?? "", invAmt, inv.id);
                    const isLogged = existingOppIds.has(inv.id);
                    const loggedRecord = (commissions ?? []).find((c) => c.opportunity_id === inv.id);
                    return (
                      <tr key={inv.id} className="border-t border-zinc-800 hover:bg-zinc-800/20 transition-colors">
                        <td className="py-2.5 pr-4 font-medium text-zinc-100">
                          {referralLeadMap.get(inv.lead_id ?? "") ?? leadMap.get(inv.lead_id ?? "") ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-zinc-400 text-xs max-w-[200px] truncate">{inv.title ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-zinc-500 text-xs">
                          {inv.close_date ? format(parseISO(inv.close_date), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-200">{fmt(invAmt)}</td>
                        <td className="py-2.5 pr-3 text-center">
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                            {isLogged && loggedRecord ? `${loggedRecord.commission_pct}%` : `${comm.pct}%`}
                          </span>
                          {!isLogged && comm.reason === "1st invoice" && (
                            <span className="ml-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">1st</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-semibold" style={{ color: "#b5c76a" }}>
                          {isLogged && loggedRecord
                            ? fmt(Number(loggedRecord.commission_amount ?? 0))
                            : fmt(comm.amount)}
                        </td>
                        <td className="py-2.5">
                          {isLogged ? (
                            loggedRecord?.status === "paid"
                              ? <span className="rounded-full bg-[#b5c76a]/10 px-2 py-0.5 text-xs text-[#b5c76a]">✅ Paid</span>
                              : <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">⬜ Pending</span>
                          ) : (
                            <span className="rounded-full bg-zinc-700/20 px-2 py-0.5 text-xs text-zinc-500">Not logged</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700">
                    <td colSpan={3} className="pt-3 text-xs text-zinc-500">Total</td>
                    <td className="pt-3 text-right tabular-nums font-bold text-zinc-200">
                      {fmt((invoices ?? []).reduce((s, i) => s + Number(i.value_excl_tax ?? i.value ?? 0), 0))}
                    </td>
                    <td />
                    <td className="pt-3 text-right tabular-nums font-bold" style={{ color: "#b5c76a" }}>
                      {fmt((invoices ?? []).reduce((s, inv) => {
                        const logged = (commissions ?? []).find((c) => c.opportunity_id === inv.id);
                        const base = Number(inv.value_excl_tax ?? inv.value ?? 0);
                        return s + (logged ? Number(logged.commission_amount ?? 0) : calcCommission(inv.lead_id ?? "", base, inv.id).amount);
                      }, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deep Cleaning referrals (non-GST) */}
      {(deepJobs ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Deep Cleaning Referrals (non-GST)</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">Referrals from manual deep-cleaning jobs, paid outside Zoho.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4 text-right">Job Amount</th>
                    <th className="pb-2 pr-3 text-center">Rate</th>
                    <th className="pb-2 pr-4 text-right">Referral</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(deepJobs ?? []).map((j) => (
                    <tr key={j.id} className="border-t border-zinc-800 hover:bg-zinc-800/20 transition-colors">
                      <td className="py-2.5 pr-4 text-zinc-500 text-xs">{j.service_date ? format(parseISO(j.service_date), "dd MMM yyyy") : "—"}</td>
                      <td className="py-2.5 pr-4 font-medium text-zinc-100">{j.customer_name}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-300">{fmt(Number(j.amount ?? 0))}</td>
                      <td className="py-2.5 pr-3 text-center">
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{j.referral_pct ?? 0}%</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums font-semibold" style={{ color: "#b5c76a" }}>{fmt(Number(j.referral_amount ?? 0))}</td>
                      <td className="py-2.5">
                        {j.referral_status === "paid"
                          ? <span className="rounded-full bg-[#b5c76a]/10 px-2 py-0.5 text-xs text-[#b5c76a]">✅ Paid</span>
                          : <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">⬜ Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700">
                    <td colSpan={4} className="pt-3 text-xs text-zinc-500">Total referral</td>
                    <td className="pt-3 text-right tabular-nums font-bold" style={{ color: "#b5c76a" }}>
                      {fmt((deepJobs ?? []).reduce((s, j) => s + Number(j.referral_amount ?? 0), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Mark referrals paid on the <a href="/deep-cleaning" className="text-[#b5c76a] hover:underline">Deep Cleaning</a> page.</p>
          </CardContent>
        </Card>
      )}

      {/* Add commission for unlogged invoices */}
      {availableInvoices.length > 0 && (
        <AddCommissionForm
          teamId={teamId}
          referrerId={id}
          invoices={availableInvoices.map((inv) => ({
            id: inv.id,
            title: inv.title ?? "—",
            value: Number(inv.value ?? 0),
            leadName: referralLeadMap.get(inv.lead_id ?? "") ?? leadMap.get(inv.lead_id ?? "") ?? "Unknown",
            closeDate: inv.close_date ?? null,
          }))}
          linkMap={Object.fromEntries([...linkMap.entries()].map(([k, v]) => [
            k,
            {
              default_commission_pct: null,
              first_commission_pct: null,
              traded_commission_pct: null,
              manufactured_commission_pct: null,
              first_invoice_used: v.first_invoice_used,
            }
          ]))}
          leadIds={Object.fromEntries((referralLeads ?? []).map((l) => [l.id, (l as { id: string; name: string; company_name: string | null }).company_name || l.name]))}
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
