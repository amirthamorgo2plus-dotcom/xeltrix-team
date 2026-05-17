import { format, isPast } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { FollowUpForm } from "./follow-up-form";
import { DoneButton } from "./done-button";

export default async function FollowUpsPage() {
  const supabase = await createClient();
  const [{ data: items }, { data: leads }] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("id, due_at, channel, notes, done_at, lead:leads(id, name)")
      .order("due_at", { ascending: true }),
    supabase.from("leads").select("id, name").order("name"),
  ]);

  const open = (items ?? []).filter((i) => !i.done_at);
  const done = (items ?? []).filter((i) => i.done_at);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Follow-ups</h1>
          <p className="text-sm text-zinc-500">{open.length} pending · {done.length} done</p>
        </div>
        <ExportButton href="/api/export/follow-ups" />
      </div>

      <FollowUpForm leads={leads ?? []} />

      <Card>
        <CardHeader>
          <CardTitle>Pending</CardTitle>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <EmptyState title="No pending follow-ups" />
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {open.map((f) => {
                const due = new Date(f.due_at);
                const overdue = isPast(due);
                const leadName =
                  Array.isArray(f.lead) ? f.lead[0]?.name : (f.lead as { name?: string } | null)?.name;
                return (
                  <li key={f.id} className="flex items-start gap-3 py-3">
                    <DoneButton id={f.id} />
                    <div className="flex-1">
                      <div className="font-medium">{leadName ?? "(no lead)"}</div>
                      {f.notes && <div className="text-xs text-zinc-500">{f.notes}</div>}
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone={overdue ? "danger" : "info"}>
                          {format(due, "dd MMM, HH:mm")}
                        </Badge>
                        {f.channel && <Badge tone="muted">{f.channel}</Badge>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Done</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {done.map((f) => {
                const leadName =
                  Array.isArray(f.lead) ? f.lead[0]?.name : (f.lead as { name?: string } | null)?.name;
                return (
                  <li key={f.id} className="py-2 text-sm text-zinc-500">
                    <span className="line-through">{leadName ?? "(no lead)"}</span>
                    <span className="ml-2 text-xs">
                      done {format(new Date(f.done_at!), "dd MMM")}
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
