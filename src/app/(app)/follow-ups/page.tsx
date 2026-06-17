import { format, isPast } from "date-fns";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { FollowUpForm } from "./follow-up-form";
import { DoneButton } from "./done-button";
import { RowActions } from "./row-actions";

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

type TabKey = "all" | "lead" | "opportunity" | "quote" | "complaint";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "opportunity", label: "Opportunities" },
  { key: "quote", label: "Quotes" },
  { key: "complaint", label: "Complaints" },
  { key: "lead", label: "Leads" },
];

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

function typeOf(f: FollowUp): TabKey {
  return (f.related_type ?? "lead") as TabKey;
}

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; show?: string }>;
}) {
  const sp = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === sp.tab)?.key as TabKey) ?? "all";
  const showDone = sp.show === "done";

  const supabase = await createClient();
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const [{ data: items }, { data: leads }, { data: opps }, { data: complaints }] =
    await Promise.all([
      supabase
        .from("follow_ups")
        .select("id, due_at, channel, notes, done_at, lead_id, related_type, related_id, auto_source")
        .eq("team_id", teamId)
        .order("due_at", { ascending: true }),
      supabase.from("leads").select("id, name").eq("team_id", teamId).order("name"),
      supabase.from("opportunities").select("id, title").eq("team_id", teamId),
      supabase.from("complaints").select("id, subject").eq("team_id", teamId),
    ]);

  const canManage = isAdminOrManager(m?.role);

  const leadName = new Map((leads ?? []).map((l) => [l.id, l.name]));
  const oppTitle = new Map((opps ?? []).map((o) => [o.id, o.title]));
  const complaintSubject = new Map((complaints ?? []).map((c) => [c.id, c.subject]));

  function renderSubject(f: FollowUp) {
    const type = f.related_type ?? "lead";
    if (type === "opportunity" && f.related_id) {
      return { text: oppTitle.get(f.related_id) ?? "(opportunity)", href: `/opportunities` };
    }
    if (type === "complaint" && f.related_id) {
      return { text: complaintSubject.get(f.related_id) ?? "(complaint)", href: `/complaints` };
    }
    if (type === "quote" && f.related_id) {
      return { text: "(quote)", href: "/quotes" };
    }
    const lid = f.related_id ?? f.lead_id;
    if (lid) return { text: leadName.get(lid) ?? "(lead)", href: `/leads` };
    return { text: "(no link)", href: null as string | null };
  }

  const all: FollowUp[] = (items ?? []) as FollowUp[];
  const filtered = tab === "all" ? all : all.filter((i) => typeOf(i) === tab);
  const open = filtered.filter((i) => !i.done_at);
  const done = filtered.filter((i) => i.done_at);

  const counts: Record<TabKey, number> = {
    all: all.filter((i) => !i.done_at).length,
    lead: all.filter((i) => !i.done_at && typeOf(i) === "lead").length,
    opportunity: all.filter((i) => !i.done_at && typeOf(i) === "opportunity").length,
    quote: all.filter((i) => !i.done_at && typeOf(i) === "quote").length,
    complaint: all.filter((i) => !i.done_at && typeOf(i) === "complaint").length,
  };

  const list = showDone ? done : open;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Follow-ups</h1>
          <p className="text-sm text-zinc-500">
            {open.length} pending · {done.length} done · auto-created from new opps &amp; complaints
          </p>
        </div>
        <ExportButton href="/api/export/follow-ups" />
      </div>

      <FollowUpForm leads={leads ?? []} />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          const showParam = showDone ? "&show=done" : "";
          return (
            <Link
              key={t.key}
              href={`/follow-ups?tab=${t.key}${showParam}`}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  active ? "bg-white/20" : "bg-zinc-200 dark:bg-zinc-800"
                }`}
              >
                {counts[t.key]}
              </span>
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/follow-ups?tab=${tab}`}
            className={`rounded-md border px-3 py-1 text-xs ${
              !showDone
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            Pending
          </Link>
          <Link
            href={`/follow-ups?tab=${tab}&show=done`}
            className={`rounded-md border px-3 py-1 text-xs ${
              showDone
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            Done
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {showDone ? "Done" : "Pending"} · {TABS.find((t) => t.key === tab)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <EmptyState
              title={showDone ? "Nothing done in this segment yet" : "No pending follow-ups"}
            />
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {list.map((f) => {
                const due = new Date(f.due_at);
                const overdue = !f.done_at && isPast(due);
                const subj = renderSubject(f);
                const source = sourceLabel(f.auto_source);
                return (
                  <li key={f.id} className="flex items-start gap-3 py-3">
                    {!f.done_at && <DoneButton id={f.id} />}
                    <div className="flex-1">
                      <div className="font-medium">
                        {subj.href ? (
                          <Link href={subj.href} className="hover:underline">
                            {subj.text}
                          </Link>
                        ) : (
                          subj.text
                        )}
                      </div>
                      {f.notes && <div className="text-xs text-zinc-500">{f.notes}</div>}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge tone={overdue ? "danger" : f.done_at ? "muted" : "info"}>
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
                        {f.done_at && (
                          <span className="text-xs text-zinc-500">
                            done {format(new Date(f.done_at), "dd MMM")}
                          </span>
                        )}
                        {source && (
                          <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                            {source}
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <div className="mt-2">
                          <RowActions
                            id={f.id}
                            isDone={!!f.done_at}
                            defaults={{
                              due_at: f.due_at,
                              channel: f.channel,
                              notes: f.notes,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
