import Link from "next/link";
import { format, addMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTeamMembers } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/ui/avatar";

type Visit = {
  id: string;
  member_id: string;
  lead_id: string | null;
  check_in_at: string;
  check_out_at: string | null;
};

type Lead = {
  id: string;
  name: string;
  owner_id: string | null;
  source: string | null;
  created_at: string;
};

function ymToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftYm(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function VisitsSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; member?: string }>;
}) {
  const sp = await searchParams;
  const ym =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : ymToday();
  const memberFilter = sp.member && sp.member !== "all" ? sp.member : null;

  // Month window in IST — must NOT rely on JS local time because Vercel runs in UTC.
  // Build the YM string for next month, then construct ISO with IST offset.
  const [yNum, mNum] = ym.split("-").map(Number);
  const nextYNum = mNum === 12 ? yNum + 1 : yNum;
  const nextMNum = mNum === 12 ? 1 : mNum + 1;
  const nextYm = `${nextYNum}-${String(nextMNum).padStart(2, "0")}`;
  const startUtc = new Date(`${ym}-01T00:00:00+05:30`);
  const nextMonthStartIso = new Date(`${nextYm}-01T00:00:00+05:30`).toISOString();

  const members = await getTeamMembers();
  const memberInfo = new Map(
    members.map((mm) => {
      const profile = (mm.profiles as unknown) as {
        full_name?: string;
        avatar_url?: string;
      } | null;
      return [
        mm.id,
        {
          name: profile?.full_name || "(unnamed)",
          avatar_url: profile?.avatar_url ?? null,
        },
      ];
    })
  );

  const supabase = await createClient();

  let visitsQuery = supabase
    .from("visits")
    .select("id, member_id, lead_id, check_in_at, check_out_at")
    .gte("check_in_at", startUtc.toISOString())
    .lt("check_in_at", nextMonthStartIso);
  if (memberFilter) visitsQuery = visitsQuery.eq("member_id", memberFilter);

  // New customers added in this month (source = 'visit' filter is broader —
  // catches reps who tap "Add new customer" from /visits, plus we count by
  // owner = the rep who added them)
  let leadsQuery = supabase
    .from("leads")
    .select("id, name, owner_id, source, created_at")
    .gte("created_at", startUtc.toISOString())
    .lt("created_at", nextMonthStartIso)
    .eq("source", "visit");
  if (memberFilter) leadsQuery = leadsQuery.eq("owner_id", memberFilter);

  const [{ data: visits }, { data: newLeadsThisMonth }, { data: allLeads }] =
    await Promise.all([
      visitsQuery,
      leadsQuery,
      supabase.from("leads").select("id, name").limit(2000),
    ]);

  const leadName = new Map(
    (allLeads ?? []).map((l) => [l.id, l.name as string])
  );

  const allVisits: Visit[] = (visits ?? []) as Visit[];
  const newLeads: Lead[] = (newLeadsThisMonth ?? []) as Lead[];

  // ---- Aggregate KPIs (filtered scope) ----
  const totalVisits = allVisits.length;
  const uniqueCustomers = new Set(
    allVisits.filter((v) => v.lead_id).map((v) => v.lead_id as string)
  ).size;
  const newCustomerCount = newLeads.length;

  let totalMinutes = 0;
  const activeDays = new Set<string>();
  allVisits.forEach((v) => {
    if (v.check_out_at) {
      const ms = new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime();
      if (ms > 0) totalMinutes += Math.round(ms / 60000);
    }
    activeDays.add(v.check_in_at.slice(0, 10));
  });
  const avgMinsPerVisit =
    totalVisits > 0 ? Math.round(totalMinutes / totalVisits) : 0;

  // ---- Per-employee breakdown (when "all" is selected) ----
  type Row = {
    memberId: string;
    visits: number;
    uniqueCustomers: Set<string>;
    newCustomers: number;
    minutes: number;
    activeDays: Set<string>;
  };
  const rows = new Map<string, Row>();
  function ensureRow(id: string): Row {
    let r = rows.get(id);
    if (!r) {
      r = {
        memberId: id,
        visits: 0,
        uniqueCustomers: new Set(),
        newCustomers: 0,
        minutes: 0,
        activeDays: new Set(),
      };
      rows.set(id, r);
    }
    return r;
  }
  allVisits.forEach((v) => {
    const r = ensureRow(v.member_id);
    r.visits += 1;
    if (v.lead_id) r.uniqueCustomers.add(v.lead_id);
    r.activeDays.add(v.check_in_at.slice(0, 10));
    if (v.check_out_at) {
      const ms = new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime();
      if (ms > 0) r.minutes += Math.round(ms / 60000);
    }
  });
  newLeads.forEach((l) => {
    if (l.owner_id) ensureRow(l.owner_id).newCustomers += 1;
  });
  const empRows = Array.from(rows.values()).sort((a, b) => b.visits - a.visits);

  // ---- Top customers visited ----
  const custCount = new Map<string, number>();
  allVisits.forEach((v) => {
    if (v.lead_id)
      custCount.set(v.lead_id, (custCount.get(v.lead_id) ?? 0) + 1);
  });
  const topCustomers = Array.from(custCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // ---- Filter URL helpers ----
  const memberOptions = members.map((mm) => {
    const profile = (mm.profiles as unknown) as { full_name?: string } | null;
    return { id: mm.id, name: profile?.full_name || "(unnamed)" };
  });

  function summaryUrl(overrides: { month?: string; member?: string | null }) {
    const params = new URLSearchParams();
    const m = "month" in overrides ? overrides.month : ym;
    const mem = "member" in overrides ? overrides.member : memberFilter;
    if (m && m !== ymToday()) params.set("month", m);
    if (mem) params.set("member", mem);
    const qs = params.toString();
    return `/visits/summary${qs ? `?${qs}` : ""}`;
  }

  const monthLabel = format(new Date(`${ym}-01`), "MMMM yyyy");
  const filterLabel = memberFilter
    ? memberInfo.get(memberFilter)?.name ?? "member"
    : "whole team";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Visits · Summary</h1>
        <p className="text-sm text-zinc-500">
          {monthLabel} · {filterLabel}
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href="/visits"
          className="rounded px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Daily
        </Link>
        <Link
          href="/visits/summary"
          className="rounded bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          Monthly summary
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          <Link
            href={summaryUrl({ month: shiftYm(ym, -1) })}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[140px] px-2 text-center text-sm font-medium tabular-nums">
            {monthLabel}
          </span>
          <Link
            href={summaryUrl({ month: shiftYm(ym, 1) })}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <form action="/visits/summary" className="flex items-end gap-2">
          <input type="hidden" name="month" value={ym} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Employee</label>
            <select
              name="member"
              defaultValue={memberFilter ?? "all"}
              suppressHydrationWarning
              className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
            >
              <option value="all">All employees</option>
              {memberOptions.map((mo) => (
                <option key={mo.id} value={mo.id}>
                  {mo.name}
                </option>
              ))}
            </select>
          </div>
          <button className="h-9 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
            Apply
          </button>
          <Link
            href={summaryUrl({ month: ymToday(), member: null })}
            className="h-9 inline-flex items-center rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            This month
          </Link>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total visits" value={totalVisits} hint={`Active days: ${activeDays.size}`} />
        <KpiCard
          label="Unique customers"
          value={uniqueCustomers}
          hint={`avg ${
            uniqueCustomers > 0
              ? (totalVisits / Math.max(1, uniqueCustomers)).toFixed(1)
              : 0
          } visits per customer`}
        />
        <KpiCard
          label="New customers added"
          value={newCustomerCount}
          hint="From check-in 'Add new'"
          tone="success"
        />
        <KpiCard
          label="Time on site"
          value={fmtHours(totalMinutes)}
          hint={`avg ${avgMinsPerVisit} min / visit`}
        />
      </div>

      {!memberFilter && (
        <Card>
          <CardHeader>
            <CardTitle>By employee</CardTitle>
          </CardHeader>
          <CardContent>
            {empRows.length === 0 ? (
              <EmptyState title="No visits this month yet" />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Employee</th>
                    <th className="pb-2 pr-4 text-right">Visits</th>
                    <th className="pb-2 pr-4 text-right">Unique customers</th>
                    <th className="pb-2 pr-4 text-right">New customers</th>
                    <th className="pb-2 pr-4 text-right">Active days</th>
                    <th className="pb-2 pr-4 text-right">Time on site</th>
                    <th className="pb-2 pr-4 text-right">Avg / visit</th>
                  </tr>
                </thead>
                <tbody>
                  {empRows.map((r) => {
                    const info = memberInfo.get(r.memberId);
                    const avg =
                      r.visits > 0 ? Math.round(r.minutes / r.visits) : 0;
                    return (
                      <tr
                        key={r.memberId}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        <td className="py-2 pr-4">
                          <Link
                            href={summaryUrl({ member: r.memberId })}
                            className="inline-flex items-center gap-2 hover:underline"
                          >
                            <Avatar
                              src={info?.avatar_url ?? null}
                              name={info?.name}
                              size={22}
                            />
                            <span className="font-medium">{info?.name}</span>
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {r.visits}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {r.uniqueCustomers.size}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {r.newCustomers > 0 ? (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              +{r.newCustomers}
                            </span>
                          ) : (
                            0
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {r.activeDays.size}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {fmtHours(r.minutes)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-zinc-500">
                          {avg} m
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Top customers visited</CardTitle>
        </CardHeader>
        <CardContent>
          {topCustomers.length === 0 ? (
            <EmptyState title="No customer visits this month" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4 text-right">Visits</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map(([leadId, count]) => (
                  <tr
                    key={leadId}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {leadName.get(leadId) ?? "(unknown)"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {newLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>New customers added this month ({newLeads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {newLeads.slice(0, 20).map((l) => {
                const adder = l.owner_id ? memberInfo.get(l.owner_id) : null;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-medium">{l.name}</span>
                    <span className="flex items-center gap-2 text-xs text-zinc-500">
                      added by {adder?.name ?? "—"} ·{" "}
                      {format(new Date(l.created_at), "dd MMM")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
