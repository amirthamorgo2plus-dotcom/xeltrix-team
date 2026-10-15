import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { RangeFilter } from "@/components/range-filter";
import { resolveRange } from "@/lib/date-range";
import { FeedbackForm } from "./feedback-form";
import { RaiseComplaint, DeleteFeedback } from "./row-actions";
import { ratingLabel, ratingTone } from "./ratings";

const CHANNELS: Record<string, string> = {
  phone: "Phone",
  whatsapp: "WhatsApp",
  in_person: "In person",
  email: "Email",
  other: "Other",
};

const RATING_FILTERS = [
  { key: "all", label: "All ratings" },
  { key: "unhappy", label: "Unhappy (1-2)" },
  { key: "3", label: "OK (3)" },
  { key: "happy", label: "Happy (4-5)" },
];

type Row = {
  id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  channel: string;
  received_on: string;
  recorded_by: string | null;
  complaint_id: string | null;
  deep_cleaning_job_id: string | null;
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; rating?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp.range ?? "all");
  const ratingFilter = sp.rating ?? "all";

  const me = await getMyMembership();
  if ((me as { attendance_only?: boolean } | null)?.attendance_only) {
    redirect("/attendance");
  }
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const canWrite = !!me && !(me as { attendance_only?: boolean }).attendance_only;
  const canDelete = isAdminOrManager(me?.role);

  const supabase = await createClient();

  let q = supabase
    .from("customer_feedback")
    .select(
      "id, customer_name, rating, comment, channel, received_on, recorded_by, complaint_id, deep_cleaning_job_id"
    )
    .eq("team_id", teamId)
    .order("received_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (range.start) q = q.gte("received_on", range.start);
  if (range.end) q = q.lte("received_on", range.end);
  if (ratingFilter === "unhappy") q = q.lte("rating", 2);
  else if (ratingFilter === "happy") q = q.gte("rating", 4);
  else if (/^[1-5]$/.test(ratingFilter)) q = q.eq("rating", Number(ratingFilter));

  const [{ data }, { data: leads }, { data: jobs }, members] = await Promise.all([
    q,
    supabase.from("leads").select("id, name").eq("team_id", teamId).order("name"),
    supabase
      .from("deep_cleaning_jobs")
      .select("id, customer_name, service_date")
      .eq("team_id", teamId)
      .in("status", ["done", "confirmed"])
      .order("service_date", { ascending: false })
      .limit(50),
    getTeamMembers(),
  ]);

  const rows = (data ?? []) as Row[];

  const nameById = new Map(
    members.map((mem) => [
      mem.id,
      ((mem.profiles as unknown) as { full_name?: string } | null)?.full_name || "(unnamed)",
    ])
  );

  // Summary over what is on screen, so it always agrees with the list below.
  const count = rows.length;
  const avg = count > 0 ? rows.reduce((s, r) => s + r.rating, 0) / count : null;
  const happy = rows.filter((r) => r.rating >= 4).length;
  // Unhappy customers nobody has picked up yet. This is the number the page
  // exists for; everything else on this strip is a score.
  const unresolved = rows.filter((r) => r.rating <= 2 && !r.complaint_id).length;

  const jobLabel = new Map(
    (jobs ?? []).map((j) => [
      j.id as string,
      `${j.customer_name}${
        j.service_date ? ` · ${format(parseISO(j.service_date as string), "dd MMM")}` : ""
      }`,
    ])
  );

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Feedback</h1>
          <p className="text-sm text-zinc-500">
            What customers say about the work. A complaint is a case to be closed; this is
            everything else, including the praise.
          </p>
        </div>
        <Link
          href="/complaints"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Complaints
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <RangeFilter
          basePath="/feedback"
          current={range.key}
          extraParams={{ rating: ratingFilter === "all" ? undefined : ratingFilter }}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {RATING_FILTERS.map((opt) => {
            const active = opt.key === ratingFilter;
            const params = new URLSearchParams();
            if (range.key !== "all") params.set("range", range.key);
            if (opt.key !== "all") params.set("rating", opt.key);
            const qs = params.toString();
            return (
              <Link
                key={opt.key}
                href={`/feedback${qs ? `?${qs}` : ""}`}
                className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs transition-colors ${
                  active
                    ? "border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Average">
          <p className="text-2xl font-bold tabular-nums">
            {avg === null ? "—" : avg.toFixed(1)}
            {avg !== null && <span className="text-sm font-normal text-zinc-500"> / 5</span>}
          </p>
          {avg !== null && <p className="text-xs text-zinc-500">{ratingLabel(Math.round(avg))}</p>}
        </Kpi>
        <Kpi label="Happy">
          <p className="text-2xl font-bold tabular-nums text-emerald-500">
            {count === 0 ? "—" : `${Math.round((happy / count) * 100)}%`}
          </p>
          <p className="text-xs text-zinc-500">
            {happy} of {count} rated 4 or 5
          </p>
        </Kpi>
        <Kpi label="Needs a response">
          <p className={`text-2xl font-bold tabular-nums ${unresolved > 0 ? "text-red-500" : ""}`}>
            {unresolved}
          </p>
          <p className="text-xs text-zinc-500">Unhappy, no complaint raised</p>
        </Kpi>
        <Kpi label="Recorded">
          <p className="text-2xl font-bold tabular-nums">{count}</p>
          <p className="text-xs text-zinc-500">In this range</p>
        </Kpi>
      </div>

      {canWrite && (
        <FeedbackForm
          leads={(leads ?? []).map((l) => ({ id: l.id as string, name: l.name as string }))}
          jobs={(jobs ?? []).map((j) => ({
            id: j.id as string,
            label: jobLabel.get(j.id as string) ?? (j.customer_name as string),
          }))}
          today={today}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title="Nothing recorded yet"
              hint="After a job, ask how it went and write down the answer."
            />
          ) : (
            <>
              {/* Phones: one card each. The comment is the point, so it gets
                  the width instead of being truncated into a cell. */}
              <ul className="divide-y divide-zinc-200 sm:hidden dark:divide-zinc-800">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.customer_name}</p>
                        <p className="text-xs text-zinc-500">
                          {format(parseISO(r.received_on), "dd MMM yyyy")} ·{" "}
                          {CHANNELS[r.channel] ?? r.channel}
                        </p>
                      </div>
                      <Badge tone={ratingTone(r.rating)}>
                        {r.rating} · {ratingLabel(r.rating)}
                      </Badge>
                    </div>
                    {r.comment && <p className="text-sm text-zinc-400">{r.comment}</p>}
                    {r.deep_cleaning_job_id && jobLabel.has(r.deep_cleaning_job_id) && (
                      <p className="text-xs text-zinc-500">
                        Job: {jobLabel.get(r.deep_cleaning_job_id)}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {r.complaint_id ? (
                        <Link href="/complaints" className="text-xs text-amber-500 hover:underline">
                          Complaint raised
                        </Link>
                      ) : (
                        r.rating <= 2 && <RaiseComplaint id={r.id} />
                      )}
                      {r.recorded_by && (
                        <span className="text-xs text-zinc-600">
                          by {nameById.get(r.recorded_by) ?? "—"}
                        </span>
                      )}
                      {canDelete && <DeleteFeedback id={r.id} />}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block">
                <Table>
                  <THead>
                    <TR hover={false}>
                      <TH>Customer</TH>
                      <TH>Rating</TH>
                      <TH>What they said</TH>
                      <TH>Heard</TH>
                      <TH>Date</TH>
                      <TH>By</TH>
                      <TH></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <TR key={r.id}>
                        <TD className="font-medium">
                          {r.customer_name}
                          {r.deep_cleaning_job_id && jobLabel.has(r.deep_cleaning_job_id) && (
                            <span className="block text-xs font-normal text-zinc-500">
                              {jobLabel.get(r.deep_cleaning_job_id)}
                            </span>
                          )}
                        </TD>
                        <TD>
                          <Badge tone={ratingTone(r.rating)}>
                            {r.rating} · {ratingLabel(r.rating)}
                          </Badge>
                        </TD>
                        <TD className="max-w-sm text-zinc-400">{r.comment ?? "—"}</TD>
                        <TD className="text-zinc-500">{CHANNELS[r.channel] ?? r.channel}</TD>
                        <TD className="whitespace-nowrap text-zinc-500">
                          {format(parseISO(r.received_on), "dd MMM yyyy")}
                        </TD>
                        <TD className="text-zinc-500">
                          {r.recorded_by ? nameById.get(r.recorded_by) ?? "—" : "—"}
                        </TD>
                        <TD>
                          <span className="flex items-center justify-end gap-2">
                            {r.complaint_id ? (
                              <Link
                                href="/complaints"
                                className="text-xs text-amber-500 hover:underline"
                              >
                                Complaint
                              </Link>
                            ) : (
                              r.rating <= 2 && <RaiseComplaint id={r.id} />
                            )}
                            {canDelete && <DeleteFeedback id={r.id} />}
                          </span>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      {children}
    </div>
  );
}
