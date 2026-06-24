import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { differenceInDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { ExportButton } from "@/components/export-button";


// ── Aging helpers ────────────────────────────────────────────────────────────

type AgingBucket = "current" | "1-15" | "16-30" | "31-45" | "45+";

function agingBucket(dueDateStr: string | null): AgingBucket {
  if (!dueDateStr) return "current";
  const days = differenceInDays(new Date(), parseISO(dueDateStr));
  if (days <= 0) return "current";
  if (days <= 15) return "1-15";
  if (days <= 30) return "16-30";
  if (days <= 45) return "31-45";
  return "45+";
}

const BUCKET_LABEL: Record<AgingBucket, string> = {
  "current": "Current",
  "1-15":    "1–15 days",
  "16-30":   "16–30 days",
  "31-45":   "31–45 days",
  "45+":     ">45 days",
};

const BUCKET_COLOR: Record<AgingBucket, string> = {
  "current": "bg-[#b5c76a]/10 text-[#b5c76a]",
  "1-15":    "bg-yellow-500/15 text-yellow-400",
  "16-30":   "bg-orange-500/15 text-orange-400",
  "31-45":   "bg-red-500/15 text-red-400",
  "45+":     "bg-red-700/20 text-red-300",
};

const BUCKET_DOT: Record<AgingBucket, string> = {
  "current": "bg-[#b5c76a]",
  "1-15":    "bg-yellow-400",
  "16-30":   "bg-orange-400",
  "31-45":   "bg-red-400",
  "45+":     "bg-red-300",
};

const BUCKETS: AgingBucket[] = ["current", "1-15", "16-30", "31-45", "45+"];

function fmtMoney(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; customer?: string }>;
}) {
  const sp = await searchParams;
  const me = await getMyMembership();
  const members = await getTeamMembers();
  const supabase = await createClient();

  const memberFilter = sp.member && sp.member !== "all" ? sp.member : null;
  const customerFilter = sp.customer && sp.customer !== "all" ? sp.customer : null;

  // Fetch all won opportunities that have a balance due (filtered by salesperson if set)
  const query = supabase
    .from("opportunities")
    .select(
      "id, title, value, balance_due, due_date, invoice_status, zoho_salesperson_name, owner_id, close_date, lead:leads(id, name, phone)"
    )
    .eq("team_id", me?.team_id ?? "")
    .eq("stage", "won")
    .gt("balance_due", 0)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (memberFilter) {
    query.eq("owner_id", memberFilter);
  }

  const { data: rows = [] } = await query;

  // ── Compute per-row aging bucket ─────────────────────────────────────────
  type Row = NonNullable<typeof rows>[number] & { bucket: AgingBucket };
  const allEnriched: Row[] = (rows ?? []).map((r) => ({
    ...r,
    bucket: agingBucket(r.due_date),
  }));

  // ── Build unique customer list from salesperson-filtered rows ────────────
  const customerMap = new Map<string, string>(); // leadId → name
  for (const r of allEnriched) {
    const lead = Array.isArray(r.lead) ? r.lead[0] : r.lead;
    if (lead?.id && lead?.name) customerMap.set(lead.id, lead.name);
  }
  const customerList = [...customerMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  // ── Apply customer filter in-memory ──────────────────────────────────────
  const enriched = customerFilter
    ? allEnriched.filter((r) => {
        const lead = Array.isArray(r.lead) ? r.lead[0] : r.lead;
        return lead?.id === customerFilter;
      })
    : allEnriched;

  // ── Summary totals by aging bucket ───────────────────────────────────────
  const summary: Record<AgingBucket, number> = {
    "current": 0, "1-15": 0, "16-30": 0, "31-45": 0, "45+": 0,
  };
  let grandTotal = 0;
  for (const r of enriched) {
    const amt = Number(r.balance_due ?? 0);
    summary[r.bucket] += amt;
    grandTotal += amt;
  }

  // ── Salesperson name helper ───────────────────────────────────────────────
  function memberName(m: typeof members[number]) {
    return ((m.profiles as unknown) as { full_name?: string } | null)?.full_name ?? m.id;
  }
  const memberMap = new Map(members.map((m) => [m.id, memberName(m)]));
  function salespersonLabel(r: Row) {
    return r.zoho_salesperson_name ?? memberMap.get(r.owner_id ?? "") ?? "Unassigned";
  }

  // ── Customer name / phone from lead ──────────────────────────────────────
  function customerName(r: Row) {
    const lead = Array.isArray(r.lead) ? r.lead[0] : r.lead;
    if (lead?.name) return lead.name;
    // Fallback: parse from title "INV-000X · Customer Name"
    const parts = (r.title ?? "").split("·");
    return parts.length > 1 ? parts.slice(1).join("·").trim() : r.title ?? "—";
  }
  function customerPhone(r: Row): string | null {
    const lead = Array.isArray(r.lead) ? r.lead[0] : r.lead;
    return lead?.phone ?? null;
  }

  // ── Invoice number from title "INV-000X · Name" ──────────────────────────
  function invoiceNumber(r: Row) {
    return (r.title ?? "").split("·")[0]?.trim() ?? "—";
  }

  // ── WhatsApp message ─────────────────────────────────────────────────────
  function waLink(r: Row) {
    const phone = customerPhone(r);
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    const num = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
    const inv = invoiceNumber(r);
    const amt = fmtMoney(Number(r.balance_due ?? 0));
    const due = r.due_date ? format(parseISO(r.due_date), "dd MMM yyyy") : "";
    const msg = encodeURIComponent(
      `Hi, this is a reminder that invoice ${inv} of ${amt}${due ? ` (due ${due})` : ""} is outstanding. Kindly arrange payment at your earliest convenience. Thank you.`
    );
    return `https://wa.me/${num}?text=${msg}`;
  }

  const isAdmin = me?.role === "admin" || me?.role === "manager";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Collections</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Outstanding invoice balances from customers</p>
        </div>
        <ExportButton href="/api/export/collections" />
      </div>

      {/* Salesperson filter */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500">Salesperson:</span>
          <Link
            href="/collections"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !memberFilter
                ? "bg-[#b5c76a]/10 text-[#b5c76a]"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            All
          </Link>
          {members.map((m) => (
            <Link
              key={m.id}
              href={`/collections?member=${m.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                memberFilter === m.id
                  ? "bg-[#b5c76a]/10 text-[#b5c76a]"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {memberName(m)}
            </Link>
          ))}
        </div>
      )}

      {/* Customer filter */}
      {customerList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500">Customer:</span>
          <Link
            href={memberFilter ? `/collections?member=${memberFilter}` : "/collections"}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !customerFilter
                ? "bg-[#b5c76a]/10 text-[#b5c76a]"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            All
          </Link>
          {customerList.map(([id, name]) => {
            const href = memberFilter
              ? `/collections?member=${memberFilter}&customer=${id}`
              : `/collections?customer=${id}`;
            return (
              <Link
                key={id}
                href={href}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  customerFilter === id
                    ? "bg-[#b5c76a]/10 text-[#b5c76a]"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {name}
              </Link>
            );
          })}
        </div>
      )}

      {/* Aging summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Total Outstanding</p>
          <p className="mt-1 text-lg font-bold text-zinc-100">{fmtMoney(grandTotal)}</p>
          <p className="mt-0.5 text-xs text-zinc-600">{enriched.length} invoice{enriched.length !== 1 ? "s" : ""}</p>
        </div>
        {BUCKETS.map((b) => (
          <div key={b} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${BUCKET_DOT[b]}`} />
              <p className="text-xs text-zinc-500">{BUCKET_LABEL[b]}</p>
            </div>
            <p className={`mt-1 text-base font-bold ${summary[b] > 0 ? "text-zinc-100" : "text-zinc-600"}`}>
              {fmtMoney(summary[b])}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      {enriched.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center">
          <p className="text-sm font-medium text-zinc-400">No outstanding collections</p>
          <p className="mt-1 text-xs text-zinc-600">
            All invoices are paid, or balance data hasn't synced yet — click Sync in Integrations.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Invoice</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Balance Due</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Aging</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Salesperson</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
              {enriched.map((r) => {
                const wa = waLink(r);
                const isOverdue = r.bucket !== "current";
                return (
                  <tr
                    key={r.id}
                    className={`transition-colors hover:bg-zinc-900/60 ${
                      r.bucket === "45+" ? "bg-red-950/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-200">
                      {customerName(r)}
                      {customerPhone(r) && (
                        <div className="text-xs text-zinc-600">{customerPhone(r)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {invoiceNumber(r)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {fmtMoney(Number(r.value ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-100">
                      {fmtMoney(Number(r.balance_due ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {r.due_date
                        ? <span className={isOverdue ? "text-red-400" : ""}>
                            {format(parseISO(r.due_date), "dd MMM yyyy")}
                          </span>
                        : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BUCKET_COLOR[r.bucket]}`}>
                        {BUCKET_LABEL[r.bucket]}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-zinc-400">{salespersonLabel(r)}</td>
                    )}
                    <td className="px-4 py-3">
                      <span className="rounded px-2 py-0.5 text-xs text-zinc-500 capitalize">
                        {r.invoice_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-[#b5c76a]/60 hover:text-[#b5c76a] transition-colors"
                        >
                          WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-700">No phone</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
