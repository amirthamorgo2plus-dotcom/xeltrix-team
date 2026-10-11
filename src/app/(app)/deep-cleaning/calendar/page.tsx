import Link from "next/link";
import {
  addDays,
  addMonths,
  format,
  getDate,
  getDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { JobForm } from "../job-form";
import { memberColor } from "@/lib/member-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

function isWeeklyOff(date: Date) {
  const dow = getDay(date);
  if (dow === 0) return true;
  if (dow === 6 && getDate(date) <= 7) return true;
  return false;
}

type Job = {
  id: string;
  customer_name: string;
  address: string | null;
  phone: string | null;
  status: string;
  service_date: string | null;
  enquiry_date: string | null;
  source: string | null;
  property_type: string | null;
  crew_size: number | null;
  amount: number | null;
  assigned_to: string | null;
  description: string | null;
};

export default async function DeepCleaningCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const cursor = sp.month ? parseISO(`${sp.month}-01`) : new Date();
  const monthStart = startOfMonth(cursor);

  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
  const isoStart = format(gridStart, "yyyy-MM-dd");
  const isoEnd = format(days[41], "yyyy-MM-dd");

  const me = await getMyMembership();
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const canManage = isAdminOrManager(me?.role);
  const teamMembers = await getTeamMembers();
  const memberNameById = new Map(
    teamMembers.map((m) => {
      const profile = m.profiles as { full_name?: string } | null;
      return [m.id as string, profile?.full_name ?? "Member"];
    })
  );

  const supabase = await createClient();
  const [{ data: booked }, { data: unscheduled }, { data: referrers }] = await Promise.all([
    supabase
      .from("deep_cleaning_jobs")
      .select(
        "id, customer_name, address, phone, status, service_date, enquiry_date, source, property_type, crew_size, amount, assigned_to, description"
      )
      .eq("team_id", teamId)
      .in("status", ["confirmed", "done"])
      .gte("service_date", isoStart)
      .lte("service_date", isoEnd)
      .order("service_date"),
    // Not limited to the visible month: an enquiry with no day is exactly
    // what someone opens this page to deal with, whatever month they are on.
    supabase
      .from("deep_cleaning_jobs")
      .select(
        "id, customer_name, address, phone, status, service_date, enquiry_date, source, property_type, crew_size, amount, assigned_to, description"
      )
      .eq("team_id", teamId)
      .eq("status", "enquiry")
      .order("enquiry_date", { ascending: true }),
    supabase.from("referrers").select("id, name, default_pct").eq("team_id", teamId).order("name"),
  ]);

  const memberList = teamMembers.map((m) => ({
    id: m.id as string,
    name: (m.profiles as { full_name?: string } | null)?.full_name ?? "Member",
  }));

  const jobsByDay = new Map<string, Job[]>();
  for (const j of (booked ?? []) as Job[]) {
    if (!j.service_date) continue;
    const arr = jobsByDay.get(j.service_date) ?? [];
    arr.push(j);
    jobsByDay.set(j.service_date, arr);
  }

  const pending = (unscheduled ?? []) as Job[];
  const monthJobs = (booked ?? []).filter((j) =>
    (j.service_date ?? "").startsWith(format(monthStart, "yyyy-MM"))
  ) as Job[];
  const monthValue = monthJobs.reduce((s, j) => s + Number(j.amount ?? 0), 0);

  const prev = format(subMonths(monthStart, 1), "yyyy-MM");
  const next = format(addMonths(monthStart, 1), "yyyy-MM");
  const thisM = format(new Date(), "yyyy-MM");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Deep cleaning schedule</h1>
          <p className="text-sm text-zinc-500">
            Confirmed and completed jobs by day. Enquiries without an agreed date are
            listed below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/deep-cleaning"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            All jobs
          </Link>
          {canManage && (
            // A job added from the schedule is a booking by default -- nobody
            // opens a calendar to log something with no date.
            <JobForm
              teamId={teamId}
              referrers={referrers ?? []}
              members={memberList}
              defaultStatus="confirmed"
              label="+ Add booking"
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {format(monthStart, "MMMM yyyy")}
              <span className="ml-2 text-sm font-normal text-zinc-500">
                {monthJobs.length} job{monthJobs.length === 1 ? "" : "s"}
                {monthValue > 0 && ` · ${fmt(monthValue)}`}
              </span>
            </span>
            <span className="flex gap-2 text-xs">
              <Link
                className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                href={`/deep-cleaning/calendar?month=${prev}`}
              >
                ← Prev
              </Link>
              <Link
                className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                href={`/deep-cleaning/calendar?month=${thisM}`}
              >
                This
              </Link>
              <Link
                className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                href={`/deep-cleaning/calendar?month=${next}`}
              >
                Next →
              </Link>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="bg-zinc-50 px-2 py-1 text-center text-xs font-medium text-zinc-500 dark:bg-zinc-900"
              >
                {d}
              </div>
            ))}
            {days.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const jobs = jobsByDay.get(iso) ?? [];
              const inMonth = isSameMonth(d, monthStart);
              const off = isWeeklyOff(d);
              // How many people are committed that day, across every job.
              const people = jobs.reduce((s, j) => s + (j.crew_size ?? 1), 0);

              return (
                <div
                  key={iso}
                  className={cn(
                    "min-h-28 bg-white p-1 text-xs dark:bg-zinc-950",
                    !inMonth && "opacity-40",
                    off && inMonth && "bg-zinc-50 dark:bg-zinc-900/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full",
                        isToday(d) && "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      )}
                    >
                      {format(d, "d")}
                    </span>
                    {people > 0 && (
                      <span
                        className="text-[10px] text-zinc-500"
                        title={`${people} ${people === 1 ? "person" : "people"} committed`}
                      >
                        {people}p
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {jobs.map((j) => {
                      const color = memberColor(j.assigned_to);
                      return (
                        <Link
                          key={j.id}
                          href="/deep-cleaning"
                          title={[
                            j.customer_name,
                            j.address,
                            j.description,
                            j.assigned_to ? `Lead: ${memberNameById.get(j.assigned_to)}` : null,
                            j.crew_size ? `${j.crew_size} people` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          className={cn(
                            "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]",
                            j.status === "done"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                              : "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color.dot)} />
                          <span className="truncate">{j.customer_name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-sky-100 dark:bg-sky-900/50" />
              Confirmed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/50" />
              Done
            </span>
            <span>The dot is the person leading the job; “3p” is people committed that day.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Enquiries waiting for a date
            {pending.length > 0 && <span className="ml-1 text-zinc-400">· {pending.length}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <EmptyState title="Nothing pending — every enquiry has been confirmed or closed" />
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {pending.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <span className="font-medium">{j.customer_name}</span>
                  {j.property_type && (
                    <Badge tone="muted">{j.property_type}</Badge>
                  )}
                  {j.address && (
                    <span className="truncate text-zinc-500">{j.address}</span>
                  )}
                  {j.phone && <span className="text-zinc-500">{j.phone}</span>}
                  {j.source && (
                    <span className="text-xs text-zinc-500">via {j.source}</span>
                  )}
                  {j.enquiry_date && (
                    <span className="ml-auto text-xs text-zinc-500">
                      enquired {format(parseISO(j.enquiry_date), "dd MMM")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
