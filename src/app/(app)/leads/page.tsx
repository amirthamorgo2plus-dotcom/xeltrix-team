import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { LeadForm } from "./lead-form";
import { LeadStatusSelect } from "./status-select";
import { LocationCell } from "./location-cell";
import { SortControl, resolveSort } from "@/components/sort-control";

function toNum(v: number | string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const statusTone: Record<string, "muted" | "info" | "success" | "warning" | "danger"> = {
  new: "info",
  contacted: "info",
  qualified: "success",
  converted: "success",
  unqualified: "muted",
  lost: "danger",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const sp = await searchParams;
  const sort = resolveSort(sp.sort);

  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, source, status, created_at, latitude, longitude, geocode_status"
    )
    .eq("team_id", teamId)
    .order(sort.column, { ascending: sort.ascending });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-zinc-500">All inbound prospects.</p>
        </div>
        <ExportButton href="/api/export/leads" />
      </div>

      <LeadForm />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{leads?.length ?? 0} total</CardTitle>
            <SortControl current={sort.key} basePath="/leads" />
          </div>
        </CardHeader>
        <CardContent>
          {!leads || leads.length === 0 ? (
            <EmptyState title="No leads yet" hint="Add your first one above." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Contact</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Location</th>
                  <th className="pb-2">Added</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-2 pr-4 font-medium">{l.name}</td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                      {l.email || l.phone || "—"}
                    </td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                      {l.source || "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <LeadStatusSelect id={l.id} value={l.status} />
                      <span className="ml-2 inline-block align-middle">
                        <Badge tone={statusTone[l.status] ?? "muted"}>{l.status}</Badge>
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <LocationCell
                        id={l.id}
                        lat={toNum(l.latitude as number | string | null)}
                        lng={toNum(l.longitude as number | string | null)}
                        status={(l.geocode_status as string | null) ?? null}
                      />
                    </td>
                    <td className="py-2 text-zinc-500">
                      {format(new Date(l.created_at), "dd MMM")}
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
