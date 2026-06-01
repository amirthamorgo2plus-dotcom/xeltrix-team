import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { ComplaintForm } from "./complaint-form";
import { ComplaintStatusSelect } from "./status-select";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";
import { SortControl, resolveSort } from "@/components/sort-control";

const sevTone: Record<string, "muted" | "info" | "warning" | "danger"> = {
  low: "muted",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp.range ?? "all");
  const sort = resolveSort(sp.sort, {
    nameColumn: "customer_name",
    dateColumn: "opened_at",
  });

  const supabase = await createClient();

  let q = supabase
    .from("complaints")
    .select("id, customer_name, subject, severity, status, opened_at, resolved_at")
    .order(sort.column, { ascending: sort.ascending });

  if (range.start) q = q.gte("opened_at", `${range.start}T00:00:00`);
  if (range.end) q = q.lte("opened_at", `${range.end}T23:59:59`);

  const { data } = await q;

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, email")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Complaints</h1>
          <p className="text-sm text-zinc-500">
            {data?.length ?? 0} in {range.label}
          </p>
        </div>
        <ExportButton href="/api/export/complaints" />
      </div>

      <RangeFilter
        basePath="/complaints"
        current={range.key}
        extraParams={{ sort: sort.key !== "newest" ? sort.key : undefined }}
      />

      <ComplaintForm leads={leads ?? []} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>All complaints</CardTitle>
            <SortControl current={sort.key} />
          </div>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <EmptyState title="No complaints in this range" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Severity</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Opened</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-2 pr-4 font-medium">{c.customer_name}</td>
                    <td className="py-2 pr-4">{c.subject}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={sevTone[c.severity] ?? "muted"}>{c.severity}</Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <ComplaintStatusSelect id={c.id} value={c.status} />
                    </td>
                    <td className="py-2 text-zinc-500">
                      {format(new Date(c.opened_at), "dd MMM")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
