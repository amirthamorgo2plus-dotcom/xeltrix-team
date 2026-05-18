import Link from "next/link";
import { format, endOfMonth, startOfMonth, addMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, getTeamSettings, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { AdvanceMappingForm } from "./mapping-form";
import { SubmissionForm } from "./submission-form";
import { BulkSubmissionForm } from "./bulk-form";
import { SubmissionRow, type Submission, type ZohoMatch } from "./submission-row";

const ADVANCE_PATTERN = /^Employee Advance[-\s](.+)$/i;
const MATCH_WINDOW_DAYS = 5;

function fmtMoney(v: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

function fuzzyMatch(advName: string, memberName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(memberName).includes(norm(advName)) || norm(advName).includes(norm(memberName));
}

function daysBetween(a: string, b: string) {
  return Math.abs(
    Math.round(
      (new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000
    )
  );
}

function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftYm(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return ymOf(d);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; account?: string; tab?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const accountFilter = (sp.account ?? "").trim();
  const tab = sp.tab === "submissions" ? "submissions" : "expenses";

  // month=ym (e.g. "2026-05"), "all", or empty -> default to current month
  const today = new Date();
  const monthFilter = sp.month === "all" ? null : sp.month ?? ymOf(today);
  const monthRange = monthFilter
    ? {
        ym: monthFilter,
        start: format(startOfMonth(new Date(`${monthFilter}-01`)), "yyyy-MM-dd"),
        end: format(endOfMonth(new Date(`${monthFilter}-01`)), "yyyy-MM-dd"),
        label: format(new Date(`${monthFilter}-01`), "MMMM yyyy"),
      }
    : null;

  const me = await getMyMembership();
  const canManage = isAdminOrManager(me?.role);
  const members = await getTeamMembers();
  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const supabase = await createClient();

  // ---------- Submissions ----------
  let subsQuery = supabase
    .from("expense_submissions")
    .select("id, member_id, date, description, amount, category, status, notes, reject_reason, zoho_expense_id")
    .order("date", { ascending: false });
  if (monthRange) {
    subsQuery = subsQuery.gte("date", monthRange.start).lte("date", monthRange.end);
  }
  const { data: subsRaw } = await subsQuery.limit(500);

  const memberNameMap = new Map(
    members.map((mm) => {
      const profile = (mm.profiles as unknown) as { full_name?: string } | null;
      return [mm.id, profile?.full_name || "(unnamed)"];
    })
  );

  const submissions: Submission[] = (subsRaw ?? []).map((s) => ({
    id: s.id as string,
    date: s.date as string,
    description: s.description as string,
    amount: Number(s.amount),
    category: (s.category as string) ?? null,
    status: s.status as "pending" | "verified" | "rejected",
    notes: (s.notes as string) ?? null,
    reject_reason: (s.reject_reason as string) ?? null,
    zoho_expense_id: (s.zoho_expense_id as string) ?? null,
    memberName: memberNameMap.get(s.member_id as string) ?? "(unknown)",
    isMine: s.member_id === me?.id,
  }));

  const pendingSubs = submissions.filter((s) => s.status === "pending");
  const verifiedSubs = submissions.filter((s) => s.status === "verified");
  const rejectedSubs = submissions.filter((s) => s.status === "rejected");

  // ---------- Zoho expenses (filtered for the listing) ----------
  let query = supabase
    .from("zoho_expenses")
    .select(
      "id, date, account_name, paid_through_account_name, vendor_name, customer_name, amount, currency_code, reference_number, description, zoho_expense_id"
    )
    .order("date", { ascending: false });

  if (q) {
    query = query.or(
      `vendor_name.ilike.%${q}%,customer_name.ilike.%${q}%,reference_number.ilike.%${q}%,description.ilike.%${q}%,account_name.ilike.%${q}%`
    );
  }
  if (accountFilter) {
    query = query.or(
      `account_name.eq.${accountFilter},paid_through_account_name.eq.${accountFilter}`
    );
  }
  if (monthRange) {
    query = query.gte("date", monthRange.start).lte("date", monthRange.end);
  }
  const { data: expenses } = await query.limit(500);

  // All rows up to end-of-month (for KPIs and cumulative outstanding)
  let aggQuery = supabase
    .from("zoho_expenses")
    .select("id, zoho_expense_id, account_name, paid_through_account_name, amount, date, vendor_name");
  if (monthRange) {
    aggQuery = aggQuery.lte("date", monthRange.end);
  }
  const { data: rowsUpToEnd } = await aggQuery;

  // Rows strictly within the month (for monthly KPI bucket)
  const inMonth = (r: { date: string | null }) => {
    if (!monthRange) return true;
    return r.date != null && r.date >= monthRange.start && r.date <= monthRange.end;
  };

  // ---------- Advance reconciliation ----------
  type AdvanceAggregate = {
    accountName: string;
    monthGiven: number;
    monthSpent: number;
    runningGiven: number;
    runningSpent: number;
    lastActivity: string | null;
    txCount: number;
  };
  const agg = new Map<string, AdvanceAggregate>();
  (rowsUpToEnd ?? []).forEach((r) => {
    const amt = Number(r.amount ?? 0);
    const date = r.date as string | null;
    const ensure = (acct: string) => {
      const e =
        agg.get(acct) ??
        {
          accountName: acct,
          monthGiven: 0,
          monthSpent: 0,
          runningGiven: 0,
          runningSpent: 0,
          lastActivity: null,
          txCount: 0,
        };
      if (date && (!e.lastActivity || date > e.lastActivity)) e.lastActivity = date;
      e.txCount += 1;
      agg.set(acct, e);
      return e;
    };
    if (r.account_name && ADVANCE_PATTERN.test(r.account_name as string)) {
      const e = ensure(r.account_name as string);
      e.runningGiven += amt;
      if (inMonth(r)) e.monthGiven += amt;
    }
    if (
      r.paid_through_account_name &&
      ADVANCE_PATTERN.test(r.paid_through_account_name as string)
    ) {
      const e = ensure(r.paid_through_account_name as string);
      e.runningSpent += amt;
      if (inMonth(r)) e.monthSpent += amt;
    }
  });
  const advanceRows = Array.from(agg.values()).sort(
    (a, b) =>
      b.runningGiven - b.runningSpent - (a.runningGiven - a.runningSpent)
  );

  const memberOpts = members.map((mem) => {
    const profile = (mem.profiles as unknown) as { full_name?: string } | null;
    return {
      id: mem.id,
      name: profile?.full_name || "(unnamed)",
      zoho_advance_account_name:
        (mem as { zoho_advance_account_name?: string }).zoho_advance_account_name ?? null,
    };
  });
  const accountToMember = new Map(
    memberOpts
      .filter((mo) => mo.zoho_advance_account_name)
      .map((mo) => [mo.zoho_advance_account_name as string, mo])
  );
  const memberToAccount = new Map(
    Array.from(accountToMember.entries()).map(([acct, mem]) => [mem.id, acct])
  );

  function autoSuggest(advAcct: string) {
    const m = advAcct.match(ADVANCE_PATTERN);
    if (!m) return null;
    const stripped = m[1].trim();
    return memberOpts.find((mo) => fuzzyMatch(stripped, mo.name)) ?? null;
  }

  function candidatesFor(s: Submission): ZohoMatch[] {
    const advAcct = memberToAccount.get(
      members.find((mm) => memberNameMap.get(mm.id) === s.memberName)?.id ?? ""
    );
    if (!advAcct) return [];
    const matches: ZohoMatch[] = [];
    (rowsUpToEnd ?? []).forEach((r) => {
      if (r.paid_through_account_name !== advAcct) return;
      if (!r.date) return;
      const dd = daysBetween(s.date, r.date as string);
      if (dd > MATCH_WINDOW_DAYS) return;
      matches.push({
        id: r.zoho_expense_id as string,
        date: r.date as string,
        amount: Number(r.amount ?? 0),
        account: (r.account_name as string) ?? null,
        vendor: (r.vendor_name as string) ?? null,
      });
    });
    return matches.sort((a, b) => {
      const aMatch = Math.abs(a.amount - s.amount) < 0.5 ? 0 : 1;
      const bMatch = Math.abs(b.amount - s.amount) < 0.5 ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return daysBetween(s.date, a.date ?? s.date) - daysBetween(s.date, b.date ?? s.date);
    });
  }

  // ---------- KPIs ----------
  const totalExpensesMonth = (rowsUpToEnd ?? [])
    .filter(inMonth)
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const monthGiven = advanceRows.reduce((s, r) => s + r.monthGiven, 0);
  const monthSpent = advanceRows.reduce((s, r) => s + r.monthSpent, 0);
  const runningOutstanding = advanceRows.reduce(
    (s, r) => s + (r.runningGiven - r.runningSpent),
    0
  );

  // Month nav links keep current tab/search context
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (accountFilter) baseParams.set("account", accountFilter);
  if (tab !== "expenses") baseParams.set("tab", tab);
  function monthUrl(ym: string | "all") {
    const p = new URLSearchParams(baseParams);
    if (ym === "all") p.set("month", "all");
    else p.set("month", ym);
    return `/expenses?${p}`;
  }
  const prevYm = monthFilter ? shiftYm(monthFilter, -1) : ymOf(addMonths(today, -1));
  const nextYm = monthFilter ? shiftYm(monthFilter, 1) : ymOf(addMonths(today, 1));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-zinc-500">
            Zoho-synced expenses · employee submissions · advance reconciliation
            {monthRange ? ` · ${monthRange.label}` : " · all time"}.
          </p>
        </div>
        <ExportButton href="/api/export/expenses" />
      </div>

      {/* Month picker */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          <Link
            href={monthUrl(prevYm)}
            aria-label="Previous month"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[140px] px-2 text-center text-sm font-medium tabular-nums">
            {monthRange ? monthRange.label : "All time"}
          </span>
          <Link
            href={monthUrl(nextYm)}
            aria-label="Next month"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <Link
          href={monthUrl(ymOf(today))}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
        >
          This month
        </Link>
        <Link
          href={monthUrl("all")}
          className={`rounded-md border px-3 py-1.5 text-xs ${
            !monthFilter
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-zinc-200 bg-white hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
          }`}
        >
          All time
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total expenses"
          value={fmtMoney(totalExpensesMonth, currency)}
          hint={monthRange ? monthRange.label : "All-time"}
        />
        <KpiCard
          label="Advances given"
          value={fmtMoney(monthGiven, currency)}
          hint={monthRange ? "This month" : "All-time"}
        />
        <KpiCard
          label="Advances spent"
          value={fmtMoney(monthSpent, currency)}
          tone="success"
          hint={monthRange ? "Cleared this month" : "Cleared all-time"}
        />
        <KpiCard
          label="Outstanding"
          value={fmtMoney(runningOutstanding, currency)}
          tone={runningOutstanding > 0 ? "warning" : "success"}
          hint={monthRange ? `As of ${monthRange.label}` : "Current balance"}
        />
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href={monthUrl(monthFilter ?? "all").replace("tab=submissions", "tab=expenses")}
          className={`rounded px-3 py-1 text-sm transition-colors ${
            tab === "expenses"
              ? "bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-300"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Zoho expenses
        </Link>
        <Link
          href={(() => {
            const p = new URLSearchParams(baseParams);
            p.set("tab", "submissions");
            if (monthFilter) p.set("month", monthFilter);
            else p.set("month", "all");
            return `/expenses?${p}`;
          })()}
          className={`rounded px-3 py-1 text-sm transition-colors ${
            tab === "submissions"
              ? "bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-300"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Submissions
          {pendingSubs.length > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
              {pendingSubs.length}
            </span>
          )}
        </Link>
      </div>

      {tab === "submissions" ? (
        <>
          <SubmissionForm />
          <BulkSubmissionForm />

          <Card>
            <CardHeader>
              <CardTitle>
                Pending verification ({pendingSubs.length})
                {canManage && pendingSubs.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    — match each against Zoho records
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingSubs.length === 0 ? (
                <EmptyState
                  title="No pending submissions"
                  hint={
                    monthRange
                      ? `for ${monthRange.label}. Try All time.`
                      : undefined
                  }
                />
              ) : (
                <ul>
                  {pendingSubs.map((s) => (
                    <SubmissionRow
                      key={s.id}
                      s={s}
                      canManage={canManage}
                      candidateMatches={candidatesFor(s)}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {verifiedSubs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Verified ({verifiedSubs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {verifiedSubs.slice(0, 50).map((s) => (
                    <SubmissionRow
                      key={s.id}
                      s={s}
                      canManage={canManage}
                      candidateMatches={[]}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {rejectedSubs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rejected ({rejectedSubs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul>
                  {rejectedSubs.slice(0, 20).map((s) => (
                    <SubmissionRow
                      key={s.id}
                      s={s}
                      canManage={canManage}
                      candidateMatches={[]}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Employee advances ({advanceRows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {advanceRows.length === 0 ? (
                <EmptyState
                  title="No employee advance accounts seen yet"
                  hint="In Zoho, create an expense account named 'Employee Advance-{Name}' and reconnect to Zoho with the expenses scope."
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="pb-2 pr-4">Account</th>
                      <th className="pb-2 pr-4 text-right">
                        Given {monthRange ? "(month)" : ""}
                      </th>
                      <th className="pb-2 pr-4 text-right">
                        Spent {monthRange ? "(month)" : ""}
                      </th>
                      <th className="pb-2 pr-4 text-right">Outstanding</th>
                      <th className="pb-2 pr-4">Tx</th>
                      <th className="pb-2 pr-4">Last</th>
                      <th className="pb-2 pr-4">Mapped to</th>
                      {canManage && <th className="pb-2">Change</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {advanceRows.map((r) => {
                      const outstanding = r.runningGiven - r.runningSpent;
                      const given = monthRange ? r.monthGiven : r.runningGiven;
                      const spent = monthRange ? r.monthSpent : r.runningSpent;
                      const mapped = accountToMember.get(r.accountName) ?? null;
                      const suggested = !mapped ? autoSuggest(r.accountName) : null;
                      return (
                        <tr key={r.accountName} className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="py-2 pr-4 font-medium">{r.accountName}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {fmtMoney(given, currency)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {fmtMoney(spent, currency)}
                          </td>
                          <td
                            className={`py-2 pr-4 text-right tabular-nums font-medium ${
                              outstanding > 0
                                ? "text-amber-600 dark:text-amber-400"
                                : outstanding < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {fmtMoney(outstanding, currency)}
                          </td>
                          <td className="py-2 pr-4 text-zinc-500">{r.txCount}</td>
                          <td className="py-2 pr-4 text-zinc-500">
                            {r.lastActivity
                              ? format(new Date(r.lastActivity), "dd MMM yyyy")
                              : "—"}
                          </td>
                          <td className="py-2 pr-4">
                            {mapped ? (
                              <Badge tone="success">{mapped.name}</Badge>
                            ) : suggested ? (
                              <span className="text-xs text-zinc-500">
                                suggest: <span className="font-medium">{suggested.name}</span>
                              </span>
                            ) : (
                              <Badge tone="muted">unmapped</Badge>
                            )}
                          </td>
                          {canManage && (
                            <td className="py-2">
                              <AdvanceMappingForm
                                advanceAccountName={r.accountName}
                                currentMemberId={mapped?.id ?? null}
                                members={memberOpts.map((mo) => ({ id: mo.id, name: mo.name }))}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Expenses ({expenses?.length ?? 0}
                {q || accountFilter ? " filtered" : ""}
                {monthRange ? ` · ${monthRange.label}` : ""})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="mb-4 flex flex-wrap gap-2" action="/expenses">
                <input type="hidden" name="tab" value="expenses" />
                {monthFilter ? (
                  <input type="hidden" name="month" value={monthFilter} />
                ) : (
                  <input type="hidden" name="month" value="all" />
                )}
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search vendor, customer, account, reference…"
                  className="h-10 max-w-md flex-1 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
                />
                {accountFilter && (
                  <input type="hidden" name="account" value={accountFilter} />
                )}
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
                >
                  Search
                </button>
                {(q || accountFilter) && (
                  <Link
                    href={monthUrl(monthFilter ?? "all")}
                    className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Clear
                  </Link>
                )}
              </form>
              {accountFilter && (
                <div className="mb-3 text-xs text-zinc-500">
                  Filtered to account: <span className="font-medium">{accountFilter}</span>
                </div>
              )}

              {!expenses || expenses.length === 0 ? (
                <EmptyState
                  title={
                    q || accountFilter
                      ? "No matching expenses"
                      : monthRange
                        ? `No expenses in ${monthRange.label}`
                        : "No expenses synced yet"
                  }
                  hint={
                    q || accountFilter
                      ? "Try a different search."
                      : monthRange
                        ? "Try a different month, or All time."
                        : "Disconnect & reconnect Zoho in /integrations to grant the expenses scope, then click Sync now."
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-zinc-500">
                      <tr>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Account</th>
                        <th className="pb-2 pr-4">Paid through</th>
                        <th className="pb-2 pr-4">Vendor</th>
                        <th className="pb-2 pr-4">Customer</th>
                        <th className="pb-2 pr-4">Ref</th>
                        <th className="pb-2 pr-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((e) => (
                        <tr key={e.id} className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="py-2 pr-4 text-zinc-500 tabular-nums">
                            {e.date ? format(new Date(e.date), "dd MMM yyyy") : "—"}
                          </td>
                          <td className="py-2 pr-4">{e.account_name ?? "—"}</td>
                          <td className="py-2 pr-4 text-zinc-500">{e.paid_through_account_name ?? "—"}</td>
                          <td className="py-2 pr-4">{e.vendor_name ?? "—"}</td>
                          <td className="py-2 pr-4 text-zinc-500">{e.customer_name ?? "—"}</td>
                          <td className="py-2 pr-4 font-mono text-xs text-zinc-500">
                            {e.reference_number ?? "—"}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {fmtMoney(Number(e.amount ?? 0), e.currency_code ?? currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
