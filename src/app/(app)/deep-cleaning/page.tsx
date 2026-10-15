import Link from "next/link";
import { redirect } from "next/navigation";
import { endOfMonth, format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { JobForm } from "./job-form";
import { PaymentToggle, ReferralToggle, DeleteJob, JobStatusSelect } from "./row-actions";
import { JobFilters } from "./filters";

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
  const supabase = await createClient();

  let jobsQuery = supabase
    .from("deep_cleaning_jobs")
    .select("id, customer_name, phone, address, status, service_date, service_time, enquiry_date, source, property_type, crew_size, description, amount, cost, payment_status, payment_mode, referrer_id, referral_pct, referral_amount, referral_status, assigned_to, notes")
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


  const referrerMap = new Map((referrers ?? []).map((r) => [r.id, r.name]));
  const memberList = (members ?? []).map((mem) => ({
    id: mem.id,
    name: (mem.profiles as { full_name?: string } | null)?.full_name ?? "Member",
  }));

  const rows = jobs ?? [];
  // Revenue and margin describe work that happened. An enquiry has no money
  // attached to it yet, and a cancelled one never will.
  const billable = rows.filter((j) => j.status === "done" || j.status === "confirmed");
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
          <p className="text-sm text-zinc-500">Non-GST service jobs recorded manually (not in Zoho). Referral paid outside Zoho.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/deep-cleaning/calendar"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Schedule
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Revenue (non-GST)</p>
          <p className="mt-1 text-xl font-bold text-zinc-100">{fmt(totalRevenue)}</p>
          <p className="text-xs text-zinc-600">
            {billable.length} job{billable.length === 1 ? "" : "s"}
            {rows.length > billable.length && (
              <span className="text-zinc-700"> · {rows.length - billable.length} enquiry</span>
            )}
          </p>
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
                        {margin != null && (
                          <span className="block text-xs tabular-nums text-[#b5c76a]">
                            {fmt(margin)} margin
                          </span>
                        )}
                      </span>
                    </div>
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
                            status: j.status, service_date: j.service_date, service_time: j.service_time,
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
                          <p className="font-medium text-zinc-100">{j.customer_name}</p>
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
                                status: j.status, service_date: j.service_date, service_time: j.service_time,
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
