import { differenceInDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { ComplaintForm } from "./complaint-form";
import { ComplaintRow, type Complaint, type ComplaintComment } from "./complaint-row";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";
import { SortControl, resolveSort } from "@/components/sort-control";

const OPEN_STATUSES = ["open", "in_progress"];

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

  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const canManage = isAdminOrManager(m?.role);

  const supabase = await createClient();

  let q = supabase
    .from("complaints")
    .select(
      "id, customer_name, customer_email, subject, description, severity, status, opened_at, resolved_at, resolution_note"
    )
    .eq("team_id", teamId)
    .order(sort.column, { ascending: sort.ascending });

  if (range.start) q = q.gte("opened_at", `${range.start}T00:00:00`);
  if (range.end) q = q.lte("opened_at", `${range.end}T23:59:59`);

  const [{ data }, { data: leads }, members] = await Promise.all([
    q,
    supabase.from("leads").select("id, name, email").eq("team_id", teamId).order("name"),
    getTeamMembers(),
  ]);

  const rows = (data ?? []) as Complaint[];

  // Case history for the complaints on screen.
  const ids = rows.map((c) => c.id);
  const { data: commentRows } = ids.length
    ? await supabase
        .from("comments")
        .select("id, subject_id, body, author_id, mentioned_ids, created_at")
        .eq("team_id", teamId)
        .eq("subject_type", "complaint")
        .in("subject_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] };

  const commentsByComplaint = new Map<string, ComplaintComment[]>();
  (commentRows ?? []).forEach((c) => {
    const arr = commentsByComplaint.get(c.subject_id as string) ?? [];
    arr.push({
      id: c.id as string,
      body: c.body as string,
      author_id: c.author_id as string,
      mentioned_ids: (c.mentioned_ids ?? []) as string[],
      created_at: c.created_at as string,
    });
    commentsByComplaint.set(c.subject_id as string, arr);
  });

  const memberList = members.map((mem) => {
    const p = (mem.profiles as unknown) as { full_name?: string; avatar_url?: string } | null;
    return {
      id: mem.id as string,
      name: p?.full_name || "(unnamed)",
      avatar_url: p?.avatar_url ?? null,
    };
  });

  // --- Stats for the selected range -----------------------------------------
  // "Opened" counts complaints raised in the range; "Resolved" counts those
  // among them that have since been closed out, so the two read as a funnel
  // rather than two unrelated numbers.
  const opened = rows.length;
  const resolved = rows.filter((c) => !!c.resolved_at).length;
  const stillOpen = rows.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  const resolvedRows = rows.filter((c) => !!c.resolved_at);
  const avgDays = resolvedRows.length
    ? Math.round(
        resolvedRows.reduce(
          (s, c) => s + differenceInDays(new Date(c.resolved_at!), new Date(c.opened_at)),
          0
        ) / resolvedRows.length
      )
    : null;
  const resolvedPct = opened > 0 ? Math.round((resolved / opened) * 100) : null;
  // Age of the oldest complaint still open — the one most worth chasing.
  const oldestOpen = rows
    .filter((c) => OPEN_STATUSES.includes(c.status))
    .reduce<number | null>((worst, c) => {
      const d = differenceInDays(new Date(), new Date(c.opened_at));
      return worst == null || d > worst ? d : worst;
    }, null);

  const stats: Array<{ label: string; value: string; hint?: string; tone?: string }> = [
    { label: "Opened", value: String(opened), hint: range.label },
    {
      label: "Resolved",
      value: String(resolved),
      hint: resolvedPct != null ? `${resolvedPct}% of opened` : undefined,
    },
    {
      label: "Still open",
      value: String(stillOpen),
      hint: oldestOpen != null ? `oldest ${oldestOpen}d` : undefined,
      tone: stillOpen > 0 ? "warn" : undefined,
    },
    {
      label: "Avg time to resolve",
      value: avgDays != null ? `${avgDays}d` : "—",
      hint: resolvedRows.length ? `over ${resolvedRows.length} resolved` : "none resolved yet",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Complaints</h1>
          <p className="text-sm text-zinc-500">
            {opened} in {range.label}
          </p>
        </div>
        <ExportButton href="/api/export/complaints" />
      </div>

      <RangeFilter
        basePath="/complaints"
        current={range.key}
        extraParams={{ sort: sort.key !== "newest" ? sort.key : undefined }}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p
              className={`mt-1 text-xl font-bold ${
                s.tone === "warn" ? "text-amber-500" : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {s.value}
            </p>
            {s.hint && <p className="text-xs text-zinc-600">{s.hint}</p>}
          </div>
        ))}
      </div>

      <ComplaintForm leads={leads ?? []} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>All complaints</CardTitle>
            <SortControl
              current={sort.key}
              basePath="/complaints"
              params={{ range: range.key !== "all" ? range.key : undefined }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No complaints in this range" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Severity</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Opened</th>
                  <th className="pb-2">Age</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <ComplaintRow
                    key={c.id}
                    complaint={c}
                    comments={commentsByComplaint.get(c.id) ?? []}
                    members={memberList}
                    myMemberId={m?.id ?? null}
                    canManage={canManage}
                    columns={6}
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
