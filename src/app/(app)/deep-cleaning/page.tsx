import Link from "next/link";
import { PhoneLink } from "@/components/phone-link";
import { redirect } from "next/navigation";
import { endOfMonth, format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { JobForm } from "./job-form";
import { PaymentToggle, ReferralToggle, DeleteJob, JobStatusSelect } from "./row-actions";
import { JobFilters } from "./filters";
import { getDeepCleaningRevenue } from "@/lib/deep-cleaning-revenue";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const STATUS_VALUES = ["enquiry", "confirmed", "done", "cancelled"];

export default async function DeepCleaningPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    payment?: string;
    assigned?: string;
    month?: string;
  }>;
}) {
  const sp = await searchParams;
  const status =
    sp.status === "open" || STATUS_VALUES.includes(sp.status ?? "") ? sp.status! : "all";
  const payment = sp.payment === "paid" || sp.payment === "pending" ? sp.payment : "all";
  const assigned = sp.assigned?.trim() || "all";
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : "all";

  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  // Attendance-only staff have no business here; the nav hides it, but a
  // typed URL should not get through either.
  if ((m as { attendance_only?: boolean } | null)?.attendance_only) {
    redirect("/attendance");
  }

  // Two levels, because they are two different risks.
  //
  // canWrite: anyone on the team runs these jobs -- takes the enquiry, moves
  // it along, marks it paid -- and RLS allows it (00040). Attendance-only
  // logins are excluded here; they have no business on this page.
  //
  // isAdmin: deleting a job is irreversible and takes its amount, cost and
  // referral payout with it, and marking a referral paid is money going out.
  // Both stay with an admin, and dcj_delete still enforces the delete.
  const isAdmin = isAdminOrManager(m?.role);
  const canWrite =
    !!m && !(m as { attendance_only?: boolean }).attendance_only;
  const settings = await getTeamSettings();
  const supabase = await createClient();

  let jobsQuery = supabase
    .from("deep_cleaning_jobs")
    .select("id, customer_name, phone, address, status, billing_entity, zoho_invoice_number, service_date, service_time, enquiry_date, source, property_type, crew_size, description, amount, cost, payment_status, payment_mode, referrer_id, referral_pct, referral_amount, referral_status, assigned_to, notes")
    .eq("team_id", teamId);

  if (status === "open") jobsQuery = jobsQuery.in("status", ["enquiry", "confirmed"]);
  else if (status !== "all") jobsQuery = jobsQuery.eq("status", status);
  if (payment !== "all") jobsQuery = jobsQuery.eq("payment_status", payment);
  if (assigned === "none") jobsQuery = jobsQuery.is("assigned_to", null);
  else if (assigned !== "all") jobsQuery = jobsQuery.eq("assigned_to", assigned);
  if (month !== "all") {
    // Filters on the day the work happens, so an enquiry with no agreed date
    // is not in any month and drops out — which is what picking a month means.
    const first = `${month}-01`;
    const last = format(endOfMonth(parseISO(first)), "yyyy-MM-dd");
    jobsQuery = jobsQuery.gte("service_date", first).lte("service_date", last);
  }

  const [{ data: jobs }, { data: referrers }, members, { data: allDates }] = await Promise.all([
    jobsQuery
      // Unscheduled enquiries have no service_date, so fall back to when they
      // came in — otherwise they all collapse to the bottom in one blob.
      .order("service_date", { ascending: false, nullsFirst: true })
      // Within a day, same order as the schedule: full-day job first, then
      // by start time.
      .order("service_time", { ascending: true, nullsFirst: true })
      .order("enquiry_date", { ascending: false }),
    supabase.from("referrers").select("id, name, default_pct").eq("team_id", teamId).order("name"),
    getTeamMembers(),
    // Unfiltered, so the month list does not shrink to whatever is selected.
    supabase.from("deep_cleaning_jobs").select("service_date").eq("team_id", teamId),
  ]);

  const filtered =
    status !== "all" || payment !== "all" || assigned !== "all" || month !== "all";
  const totalRows = (allDates ?? []).length;
  const months = [
    ...new Set(
      (allDates ?? [])
        .map((r) => r.service_date as string | null)
        .filter((d): d is string => !!d)
        .map((d) => d.slice(0, 7))
    ),
  ].sort((a, b) => b.localeCompare(a));


  // Everything billed as deep cleaning, by either company, for the month
  // being viewed -- or the year to date when no month is chosen, since the
  // page is otherwise unfiltered by date.
  const revFrom = month !== "all" ? `${month}-01` : `${new Date().getFullYear()}-01-01`;
  const revTo =
    month !== "all"
      ? format(endOfMonth(parseISO(`${month}-01`)), "yyyy-MM-dd")
      : `${new Date().getFullYear()}-12-31`;
  const combined = await getDeepCleaningRevenue(
    supabase,
    teamId,
    revFrom,
    revTo,
    settings?.deep_cleaning_items ?? null
  );

  const referrerMap = new Map((referrers ?? []).map((r) => [r.id, r.name]));
  const memberList = (members ?? []).map((mem) => ({
    id: mem.id,
    name: (mem.profiles as { full_name?: string } | null)?.full_name ?? "Member",
  }));

  const rows = jobs ?? [];
  // Revenue and margin describe work that happened. An enquiry has no money
  // attached to it yet, and a cancelled one never will.
  // Work that has happened or is booked. An enquiry has no money attached
  // yet and a cancelled one never will.
  const real = rows.filter((j) => j.status === "done" || j.status === "confirmed");
  // Purex is the cash side: its revenue is counted here because nowhere else
  // records it. Xeltrix work is on a Zoho invoice and counted in sales, so
  // counting it here too is exactly the double count this exists to stop.
  const billable = real.filter((j) => j.billing_entity !== "xeltrix");
  const xeltrixJobs = real.filter((j) => j.billing_entity === "xeltrix");
  const xeltrixRevenue = xeltrixJobs.reduce((s, j) => s + Number(j.amount ?? 0), 0);
  const invoicedCount = xeltrixJobs.length;
  const totalRevenue = billable.reduce((s, j) => s + Number(j.amount ?? 0), 0);
  const totalCost = billable.reduce((s, j) => s + Number(j.cost ?? 0), 0);
  const totalMargin = totalRevenue - totalCost;
  const referralPending = rows
    .filter((j) => j.referrer_id && j.referral_status !== "paid")
    .reduce((s, j) => s + Number(j.referral_amount ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Deep Cleaning</h1>
          <p className="text-sm text-zinc-500">
            Every cleaning job, whichever company billed it. Purex cash is counted from the
            job; Xeltrix work is counted from its Zoho invoice. Referral paid outside Zoho.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/deep-cleaning/calendar"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Schedule
          </Link>
          <Link
            href="/deep-cleaning/quote"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Quote
          </Link>
          {canWrite && (
            <JobForm teamId={teamId} referrers={referrers ?? []} members={memberList} />
          )}
        </div>
      </div>

      <JobFilters
        members={memberList}
        months={months}
        current={{ status, payment, assigned, month }}
      />

      {/* Everything billed as deep cleaning, however it was billed. This is
          the number to compare against a target: the KPIs below deliberately
          split it, because the two halves are counted in different places. */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs text-zinc-500">
            All deep cleaning ·{" "}
            {month !== "all"
              ? format(parseISO(`${month}-01`), "MMMM yyyy")
              : `${new Date().getFullYear()}`}
          </span>
          <span className="text-2xl font-bold tabular-nums text-zinc-100">
            {fmt(combined.total)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span className="text-zinc-500">
            Purex cash{" "}
            <span className="tabular-nums text-[#b5c76a]">{fmt(combined.purex)}</span>{" "}
            <span className="text-zinc-600">
              · {combined.purexJobs} job{combined.purexJobs === 1 ? "" : "s"}
            </span>
          </span>
          <span className="text-zinc-500">
            Xeltrix invoiced{" "}
            <span className="tabular-nums text-sky-400">{fmt(combined.xeltrix)}</span>{" "}
            <span className="text-zinc-600">
              · {combined.xeltrixLines} invoice line
              {combined.xeltrixLines === 1 ? "" : "s"}
            </span>
          </span>
        </div>
        {/* The two should match: a Xeltrix job and its invoice line are the
            same piece of work. Which way they differ says something
            different, so say which. */}
        {combined.xeltrixLines > combined.xeltrixJobs && (
          <p className="mt-2 text-[11px] text-amber-500">
            {combined.xeltrixLines - combined.xeltrixJobs} invoiced cleaning line
            {combined.xeltrixLines - combined.xeltrixJobs === 1 ? " has" : "s have"} no job
            on the schedule. The money is counted above, but the work was never recorded
            here — no crew, cost or margin for it.
          </p>
        )}
        {combined.xeltrixJobs > combined.xeltrixLines && (
          <p className="mt-2 text-[11px] text-amber-500">
            {combined.xeltrixJobs - combined.xeltrixLines} job
            {combined.xeltrixJobs - combined.xeltrixLines === 1 ? " is" : "s are"} marked as
            billed by Xeltrix with no matching invoice line. Either the invoice was never
            raised, or it used an item name the app does not count as cleaning.
          </p>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Purex cash revenue (non-GST)</p>
          <p className="mt-1 text-xl font-bold text-zinc-100">{fmt(totalRevenue)}</p>
          <p className="text-xs text-zinc-600">
            {billable.length} Purex job{billable.length === 1 ? "" : "s"}
          </p>
          {invoicedCount > 0 && (
            <p className="mt-1 border-t border-zinc-800 pt-1 text-xs text-zinc-500">
              Xeltrix (GST){" "}
              <span className="tabular-nums text-sky-400">{fmt(xeltrixRevenue)}</span> ·{" "}
              {invoicedCount} job{invoicedCount === 1 ? "" : "s"}
              <span className="block text-[11px] text-zinc-600">
                counted in sales, not here
              </span>
            </p>
          )}
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
          <CardTitle>
            {filtered
              ? `${rows.length} of ${totalRows} job${totalRows === 1 ? "" : "s"}`
              : `${rows.length} job${rows.length === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && filtered ? (
            <EmptyState title="No jobs match these filters" />
          ) : rows.length === 0 ? (
            <EmptyState title="No deep cleaning jobs yet" hint="Add a job to start tracking non-GST service work." />
          ) : (
            <>
            {/* Phones: one card per job. Nine columns of money and referral
                state do not fit 375px, and the controls that matter on site
                are the two toggles, so they stay. */}
            <ul className="divide-y divide-zinc-800 sm:hidden">
              {rows.map((j) => {
                const amount = Number(j.amount ?? 0);
                const cost = j.cost != null ? Number(j.cost) : null;
                const margin = cost != null ? amount - cost : null;
                return (
                  <li key={j.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">
                          {j.customer_name}
                        </p>
                        {j.description && (
                          <p className="truncate text-xs text-zinc-500">{j.description}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block tabular-nums text-zinc-100">{fmt(amount)}</span>
                        {j.billing_entity === "xeltrix" && (
                          <span className="block text-[11px] text-sky-400">
                            Xeltrix{j.zoho_invoice_number ? ` · ${j.zoho_invoice_number}` : ""}
                          </span>
                        )}
                        {margin != null && (
                          <span className="block text-xs tabular-nums text-[#b5c76a]">
                            {fmt(margin)} margin
                          </span>
                        )}
                      </span>
                    </div>
                    {j.phone && (
                      <PhoneLink phone={j.phone} className="text-sm text-zinc-300" />
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>
                        {j.service_date
                          ? `${format(parseISO(j.service_date), "dd MMM yyyy")} · ${
                              j.service_time ? String(j.service_time).slice(0, 5) : "full day"
                            }`
                          : j.enquiry_date
                            ? `enquired ${format(parseISO(j.enquiry_date), "dd MMM")}`
                            : "no date"}
                      </span>
                      {j.referrer_id && (
                        <span className="text-[#b5c76a]">
                          via {referrerMap.get(j.referrer_id) ?? "referrer"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <JobStatusSelect id={j.id} status={j.status} canManage={canWrite} />
                      <PaymentToggle
                        id={j.id}
                        status={j.payment_status}
                        canManage={canWrite}
                      />
                      {canWrite && (
                        <JobForm
                          teamId={teamId}
                          referrers={referrers ?? []}
                          members={memberList}
                          trigger="edit"
                          edit={{
                            id: j.id, customer_name: j.customer_name, phone: j.phone, address: j.address,
                            status: j.status, billing_entity: j.billing_entity,
                            zoho_invoice_number: j.zoho_invoice_number,
                            service_date: j.service_date, service_time: j.service_time,
                            enquiry_date: j.enquiry_date,
                            source: j.source, property_type: j.property_type, crew_size: j.crew_size,
                            description: j.description, amount, cost,
                            payment_status: j.payment_status, payment_mode: j.payment_mode,
                            referrer_id: j.referrer_id, referral_pct: j.referral_pct,
                            assigned_to: j.assigned_to, notes: j.notes,
                          }}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3">Customer</th>
                    <th className="pb-2 pr-3">Status</th>
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
                          {j.service_date ? (
                            <>
                              {format(parseISO(j.service_date), "dd MMM yyyy")}
                              <span className="ml-1 text-zinc-500">
                                {j.service_time
                                  ? String(j.service_time).slice(0, 5)
                                  : "full day"}
                              </span>
                            </>
                          ) : j.enquiry_date ? (
                            <span className="text-zinc-600">
                              enq {format(parseISO(j.enquiry_date), "dd MMM")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-zinc-100">
                            {j.customer_name}
                            {j.billing_entity === "xeltrix" && (
                              <span
                                className="ml-2 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-normal text-sky-400"
                                title="Billed by Xeltrix on a GST invoice — counted in sales, not in Purex cash revenue"
                              >
                                Xeltrix{j.zoho_invoice_number ? ` · ${j.zoho_invoice_number}` : ""}
                              </span>
                            )}
                          </p>
                          {j.description && <p className="text-xs text-zinc-500 max-w-[220px] truncate">{j.description}</p>}
                        </td>
                        <td className="py-2.5 pr-3">
                          <JobStatusSelect id={j.id} status={j.status} canManage={canWrite} />
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">{fmt(amount)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-[#b5c76a]">{margin != null ? fmt(margin) : "—"}</td>
                        <td className="py-2.5 pr-3 text-center"><PaymentToggle id={j.id} status={j.payment_status} canManage={canWrite} /></td>
                        <td className="py-2.5 pr-3 text-[#b5c76a]">{j.referrer_id ? (referrerMap.get(j.referrer_id) ?? "—") : <span className="text-zinc-600">—</span>}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {j.referrer_id && j.referral_amount != null
                            ? <span className="text-amber-400">{fmt(Number(j.referral_amount))} <span className="text-zinc-600 text-xs">({j.referral_pct}%)</span></span>
                            : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          {j.referrer_id && j.referral_amount ? <ReferralToggle id={j.id} status={j.referral_status} canManage={isAdmin} /> : <span className="text-zinc-700 text-xs">—</span>}
                        </td>
                        <td className="py-2.5 flex items-center gap-2">
                          {canWrite && (
                            <JobForm
                              teamId={teamId}
                              referrers={referrers ?? []}
                              members={memberList}
                              trigger="edit"
                              edit={{
                                id: j.id, customer_name: j.customer_name, phone: j.phone, address: j.address,
                                status: j.status, billing_entity: j.billing_entity,
                                zoho_invoice_number: j.zoho_invoice_number,
                                service_date: j.service_date, service_time: j.service_time,
                                enquiry_date: j.enquiry_date,
                                source: j.source, property_type: j.property_type, crew_size: j.crew_size,
                                description: j.description, amount, cost,
                                payment_status: j.payment_status, payment_mode: j.payment_mode,
                                referrer_id: j.referrer_id, referral_pct: j.referral_pct, assigned_to: j.assigned_to, notes: j.notes,
                              }}
                            />
                          )}
                          <DeleteJob id={j.id} canManage={isAdmin} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
