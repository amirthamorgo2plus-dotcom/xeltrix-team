import { differenceInDays, format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getTeamSettings, getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";

function fmtMoney(v: number | null | undefined, currency = "INR") {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

const statusTone: Record<string, "muted" | "info" | "success" | "warning" | "danger"> = {
  draft: "muted",
  sent: "info",
  viewed: "info",
  accepted: "success",
  invoiced: "success",
  declined: "danger",
  expired: "warning",
};

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp.range ?? "all");
  const settings = await getTeamSettings();
  const currency = settings?.currency || "INR";

  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";

  const supabase = await createClient();
  let q = supabase
    .from("quotes")
    .select("id, number, status, value, value_excl_tax, currency, date, expiry_date, customer_name, lead_id, zoho_salesperson_name")
    .eq("team_id", teamId)
    .order("date", { ascending: false });

  if (sp.status) q = q.eq("status", sp.status);
  if (range.start) q = q.gte("date", range.start);
  if (range.end) q = q.lte("date", range.end);
  const { data: quotes } = await q.limit(500);

  // KPI summary
  const openStatuses = new Set(["draft", "sent", "viewed", "accepted"]);
  const openValue = (quotes ?? [])
    .filter((qt) => openStatuses.has(qt.status))
    .reduce((s, qt) => s + Number(qt.value ?? 0), 0);
  const openCount = (quotes ?? []).filter((qt) => openStatuses.has(qt.status)).length;
  const expiringSoon = (quotes ?? []).filter((qt) => {
    if (!qt.expiry_date || !openStatuses.has(qt.status)) return false;
    const days = differenceInDays(parseISO(qt.expiry_date), new Date());
    return days >= 0 && days <= 7;
  }).length;

  const statuses = ["draft", "sent", "viewed", "accepted", "declined", "invoiced", "expired"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quotes</h1>
          <p className="text-sm text-zinc-500">
            Estimates synced from Zoho Books. Open quotes are draft/sent/viewed/accepted.
          </p>
        </div>
        <ExportButton href="/api/export/quotes" />
      </div>

      <RangeFilter basePath="/quotes" current={range.key} extraParams={{ status: sp.status }} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Open quotes</CardTitle>
            <div className="text-3xl font-semibold">{openCount}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open value</CardTitle>
            <div className="text-3xl font-semibold">{fmtMoney(openValue, currency)}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expiring in ≤7 days</CardTitle>
            <div className="text-3xl font-semibold">{expiringSoon}</div>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="/quotes"
          className={`rounded-md border px-3 py-1 text-xs ${
            !sp.status
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          }`}
        >
          All
        </a>
        {statuses.map((s) => (
          <a
            key={s}
            href={`/quotes?status=${s}`}
            className={`rounded-md border px-3 py-1 text-xs capitalize ${
              sp.status === s
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{quotes?.length ?? 0} quote{quotes?.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {!quotes || quotes.length === 0 ? (
            <EmptyState
              title="No quotes yet"
              hint="Connect Zoho and sync. If already connected, you may need to reconnect to grant the estimates scope."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="pb-2 pr-4">Number</th>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Salesperson</th>
                    <th className="pb-2 pr-4 text-right">Incl. tax</th>
                    <th className="pb-2 pr-4 text-right">Excl. tax</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Expiry</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((qt) => {
                    const expiry = qt.expiry_date ? parseISO(qt.expiry_date) : null;
                    const expiryDays = expiry ? differenceInDays(expiry, new Date()) : null;
                    const isOpen = openStatuses.has(qt.status);
                    return (
                      <tr key={qt.id} className="border-t border-zinc-200 dark:border-zinc-800">
                        <td className="py-2 pr-4 font-mono text-xs">{qt.number}</td>
                        <td className="py-2 pr-4 font-medium">{qt.customer_name}</td>
                        <td className="py-2 pr-4 text-zinc-500">
                          {qt.zoho_salesperson_name ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {fmtMoney(Number(qt.value), qt.currency || currency)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-zinc-500">
                          {fmtMoney(Number(qt.value_excl_tax ?? qt.value ?? 0), qt.currency || currency)}
                        </td>
                        <td className="py-2 pr-4 text-zinc-500">
                          {qt.date ? format(parseISO(qt.date), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {expiry ? (
                            <span
                              className={
                                isOpen && expiryDays !== null && expiryDays < 0
                                  ? "text-red-600"
                                  : isOpen && expiryDays !== null && expiryDays <= 7
                                  ? "text-amber-600"
                                  : "text-zinc-500"
                              }
                            >
                              {format(expiry, "dd MMM yyyy")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2">
                          <Badge tone={statusTone[qt.status] ?? "muted"}>{qt.status}</Badge>
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
