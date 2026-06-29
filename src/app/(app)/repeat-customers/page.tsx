import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { KpiCard } from "@/components/kpi-card";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import {
  computeRepeatCustomers,
  summarize,
  type WonOppRow,
  type CustomerStat,
} from "@/lib/repeat-customers";
import { RepeatCustomersTable } from "./table";

const CURRENCY = "INR";
function fmtMoney(v: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(v);
}

function waReorderLink(c: CustomerStat): string | null {
  if (!c.phone) return null;
  const cleaned = c.phone.replace(/\D/g, "");
  const num = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
  const msg = encodeURIComponent(
    `Hi ${c.name}, hope you're doing well! It's been about ${c.daysSinceLast} days since your last order. Would you like to place a reorder? Happy to help.`
  );
  return `https://wa.me/${num}?text=${msg}`;
}

export default async function RepeatCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const sp = await searchParams;
  const me = await getMyMembership();
  const members = await getTeamMembers();
  const supabase = await createClient();

  const isAdmin = me?.role === "admin" || me?.role === "manager";
  const memberFilter = isAdmin && sp.member && sp.member !== "all" ? sp.member : null;

  function memberName(m: (typeof members)[number]) {
    return ((m.profiles as unknown) as { full_name?: string } | null)?.full_name ?? m.id;
  }
  const myZoho =
    (members.find((m) => m.id === me?.id) as { zoho_salesperson_name?: string | null } | undefined)
      ?.zoho_salesperson_name ?? null;

  const { data: rows = [] } = await supabase
    .from("opportunities")
    .select(
      "id, title, value, value_excl_tax, close_date, lead_id, zoho_customer_id, owner_id, zoho_salesperson_name, lead:leads(id, name, phone)"
    )
    .eq("team_id", me?.team_id ?? "")
    .eq("stage", "won")
    .not("close_date", "is", null);

  // Scope rows: members see their own customers; admins see all (or one salesperson).
  let scoped = (rows ?? []) as WonOppRow[];
  if (!isAdmin) {
    scoped = scoped.filter((r) => r.owner_id === me?.id || (myZoho && r.zoho_salesperson_name === myZoho));
  } else if (memberFilter) {
    scoped = scoped.filter((r) => r.owner_id === memberFilter);
  }

  const stats = computeRepeatCustomers(scoped);
  const sum = summarize(stats);
  const dueList = stats.filter((s) => s.status !== "on_track").slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Repeat Customers</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Ordering frequency and reorder reminders, based on each customer&apos;s order history.
        </p>
      </div>

      {/* Salesperson filter (admins) */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500">Salesperson:</span>
          <Link
            href="/repeat-customers"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !memberFilter ? "bg-[#b5c76a]/10 text-[#b5c76a]" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            All
          </Link>
          {members.map((m) => (
            <Link
              key={m.id}
              href={`/repeat-customers?member=${m.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                memberFilter === m.id ? "bg-[#b5c76a]/10 text-[#b5c76a]" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {memberName(m)}
            </Link>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Repeat customers" value={sum.repeatCount} hint="customers with 2+ orders" />
        <KpiCard
          label="Due for reorder"
          value={sum.dueCount}
          hint={`${sum.overdueCount} overdue · ${sum.dueSoonCount} due soon`}
          tone={sum.overdueCount > 0 ? "danger" : sum.dueCount > 0 ? "warning" : "success"}
        />
        <KpiCard label="Value at risk" value={fmtMoney(sum.valueAtRisk)} hint="avg order value of overdue customers" tone={sum.valueAtRisk > 0 ? "warning" : null} />
      </div>

      {/* Due-for-reorder highlight */}
      {dueList.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-300">Due for reorder</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dueList.map((c) => {
              const wa = waReorderLink(c);
              return (
                <div
                  key={c.key}
                  className={`rounded-xl border p-4 ${
                    c.status === "overdue" ? "border-red-500/30 bg-red-950/10" : "border-amber-500/25 bg-amber-950/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-zinc-100">{c.name}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "overdue" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {c.status === "overdue" ? "Overdue" : "Due soon"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Last order {c.daysSinceLast}d ago · usually every ~{c.typicalIntervalDays}d
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Expected reorder by {format(parseISO(c.expectedNextDate), "dd MMM yyyy")} · avg {fmtMoney(c.avgOrderValue)}
                  </p>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-[#b5c76a]/60 hover:text-[#b5c76a]"
                    >
                      Remind on WhatsApp
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full sortable table */}
      <RepeatCustomersTable rows={stats} isAdmin={!!isAdmin} currency={CURRENCY} />
    </div>
  );
}
