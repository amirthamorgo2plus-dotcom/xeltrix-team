import { format, isPast } from "date-fns";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { FollowUpForm } from "./follow-up-form";
import { DoneButton } from "./done-button";

type FollowUp = {
  id: string;
  due_at: string;
  channel: string | null;
  notes: string | null;
  done_at: string | null;
  lead_id: string | null;
  related_type: string | null;
  related_id: string | null;
  auto_source: string | null;
};

function sourceLabel(s: string | null): string | null {
  if (!s) return null;
  switch (s) {
    case "opp_created":
      return "auto · new opp";
    case "opp_proposal":
      return "auto · quote sent";
    case "opp_negotiation":
      return "auto · negotiation";
    case "complaint_open":
      return "auto · complaint";
    default:
      return "auto";
  }
}

export default async function FollowUpsPage() {
  const supabase = await createClient();
  const [{ data: items }, { data: leads }, { data: opps }, { data: complaints }] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("id, due_at, channel, notes, done_at, lead_id, related_type, related_id, auto_source")
      .order("due_at", { ascending: true }),
    supabase.from("leads").select("id, name").order("name"),
    supabase.from("opportunities").select("id, title"),
    supabase.from("complaints").select("id, subject"),
  ]);

  const leadName = new Map((leads ?? []).map((l) => [l.id, l.name]));
  const oppTitle = new Map((opps ?? []).map((o) => [o.id, o.title]));
  const complaintSubject = new Map((complaints ?? []).map((c) => [c.id, c.subject]));

  function renderSubject(f: FollowUp) {
    const type = f.related_type ?? "lead";
    if (type === "opportunity" && f.related_id) {
      const title = oppTitle.get(f.related_id);
      return {
        text: title ?? "(opportunity)",
        href: `/opportunities`,
      };
    }
    if (type === "complaint" && f.related_id) {
      return {
        text: complaintSubject.get(f.related_id) ?? "(complaint)",
        href: `/complaints`,
      };
    }
    if (type === "quote" && f.related_id) {
      return { text: "(quote)", href: "/quotes" };
    }
    const lid = f.related_id ?? f.lead_id;
    if (lid) return { text: leadName.get(lid) ?? "(lead)", href: `/leads` };
    return { text: "(no link)", href: null as string | null };
  }

  const followups: FollowUp[] = (items ?? []) as FollowUp[];
  const open = followups.filter((i) => !i.done_at);
  const done = followups.filter((i) => i.done_at);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Follow-ups</h1>
          <p className="text-sm text-zinc-500">
            {open.length} pending · {done.length} done · auto-created from new opps & complaints
          </p>
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
                const subj = renderSubject(f);
                const source = sourceLabel(f.auto_source);
                return (
                  <li key={f.id} className="flex items-start gap-3 py-3">
                    <DoneButton id={f.id} />
                    <div className="flex-1">
                      <div className="font-medium">
                        {subj.href ? (
                          <Link
                            href={subj.href}
                            className="hover:underline"
                          >
                            {subj.text}
                          </Link>
                        ) : (
                          subj.text
                        )}
                      </div>
                      {f.notes && <div className="text-xs text-zinc-500">{f.notes}</div>}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge tone={overdue ? "danger" : "info"}>
                          {format(due, "dd MMM, HH:mm")}
                        </Badge>
                        {f.channel && <Badge tone="muted">{f.channel}</Badge>}
                        {f.related_type && f.related_type !== "lead" && (
                          <Badge
                            tone={
                              f.related_type === "opportunity"
                                ? "info"
                                : f.related_type === "complaint"
                                  ? "warning"
                                  : "muted"
                            }
                          >
                            {f.related_type}
                          </Badge>
                        )}
                        {source && (
                          <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                            {source}
                          </span>
                        )}
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
                const subj = renderSubject(f);
                return (
                  <li key={f.id} className="py-2 text-sm text-zinc-500">
                    <span className="line-through">{subj.text}</span>
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
