import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ComplaintForm } from "./complaint-form";
import { ComplaintStatusSelect } from "./status-select";

const sevTone: Record<string, "muted" | "info" | "warning" | "danger"> = {
  low: "muted",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export default async function ComplaintsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("complaints")
    .select("id, customer_name, subject, severity, status, opened_at, resolved_at")
    .order("opened_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Complaints</h1>
        <p className="text-sm text-zinc-500">{data?.length ?? 0} total</p>
      </div>

      <ComplaintForm />

      <Card>
        <CardHeader>
          <CardTitle>All complaints</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <EmptyState title="No complaints yet" />
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
