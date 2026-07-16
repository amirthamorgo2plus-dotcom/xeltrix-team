import {
  addDays, addMonths, endOfMonth, format, getDate, getDay,
  isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ist } from "@/lib/ist";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function isWeeklyOff(date: Date) {
  const dow = getDay(date);
  if (dow === 0) return true;
  if (dow === 6 && getDate(date) <= 7) return true;
  return false;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const cursor = sp.month ? parseISO(`${sp.month}-01`) : new Date();
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));

  const isoStart = format(gridStart, "yyyy-MM-dd");
  const isoEnd = format(days[41], "yyyy-MM-dd");

  const supabase = await createClient();
  const m = await getMyMembership();
  const teamId = m?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const teamMembers = await getTeamMembers();
  const memberNameById = new Map(
    teamMembers.map((m) => {
      const profile = m.profiles as { full_name?: string } | null;
      return [m.id, profile?.full_name ?? "Someone"];
    })
  );

  const [holRes, taskRes, fuRes, attRes] = await Promise.all([
    supabase
      .from("holidays")
      .select("date, name, working_allowed")
      .eq("team_id", teamId)
      .gte("date", isoStart)
      .lte("date", isoEnd),
    supabase
      .from("tasks")
      .select("id, title, due_at, status")
      .eq("team_id", teamId)
      .gte("due_at", `${isoStart}T00:00:00`)
      .lte("due_at", `${isoEnd}T23:59:59`)
      .neq("status", "done")
      .neq("status", "cancelled"),
    supabase
      .from("follow_ups")
      .select("id, due_at, lead:leads(name)")
      .eq("team_id", teamId)
      .gte("due_at", `${isoStart}T00:00:00`)
      .lte("due_at", `${isoEnd}T23:59:59`)
      .is("done_at", null),
    supabase
      .from("attendance")
      // attendance has no team_id — scope by current-org members
      .select("date, status, member_id")
      .in(
        "member_id",
        teamMembers.length
          ? teamMembers.map((mm) => mm.id)
          : ["00000000-0000-0000-0000-000000000000"]
      )
      .gte("date", isoStart)
      .lte("date", isoEnd)
      .in("status", ["leave", "half_day"]),
  ]);

  type Event = { kind: "holiday" | "task" | "followup" | "leave"; label: string };
  const eventsByDay = new Map<string, Event[]>();
  const pushEvent = (iso: string, e: Event) => {
    const arr = eventsByDay.get(iso) ?? [];
    arr.push(e);
    eventsByDay.set(iso, arr);
  };

  (holRes.data ?? []).forEach((h) =>
    pushEvent(h.date, { kind: "holiday", label: h.name })
  );
  (taskRes.data ?? []).forEach((t) => {
    if (!t.due_at) return;
    pushEvent(format(ist(t.due_at), "yyyy-MM-dd"), { kind: "task", label: t.title });
  });
  (fuRes.data ?? []).forEach((f) => {
    const lead = Array.isArray(f.lead)
      ? (f.lead as { name?: string }[])[0]
      : (f.lead as { name?: string } | null);
    pushEvent(format(ist(f.due_at), "yyyy-MM-dd"), {
      kind: "followup",
      label: lead?.name ?? "follow-up",
    });
  });
  (attRes.data ?? []).forEach((a) => {
    const name = memberNameById.get(a.member_id) ?? "Someone";
    pushEvent(a.date as string, {
      kind: "leave",
      label: `${name} on ${a.status}`,
    });
  });

  const prev = format(subMonths(monthStart, 1), "yyyy-MM");
  const next = format(addMonths(monthStart, 1), "yyyy-MM");
  const thisM = format(monthStart, "yyyy-MM");

  const eventTone = {
    holiday: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    task: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
    followup: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
    leave: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
  } as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-zinc-500">Holidays, leaves, tasks, and follow-ups in one place.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{format(monthStart, "MMMM yyyy")}</span>
            <span className="flex gap-2 text-xs">
              <a className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700"
                 href={`/calendar?month=${prev}`}>← Prev</a>
              <a className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700"
                 href={`/calendar?month=${thisM}`}>This</a>
              <a className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700"
                 href={`/calendar?month=${next}`}>Next →</a>
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
              const events = eventsByDay.get(iso) ?? [];
              const inMonth = isSameMonth(d, monthStart);
              const today = isToday(d);
              const off = isWeeklyOff(d) || events.some((e) => e.kind === "holiday");

              return (
                <div
                  key={iso}
                  className={cn(
                    "min-h-24 bg-white p-1 text-xs dark:bg-zinc-950",
                    !inMonth && "opacity-40",
                    off && inMonth && "bg-zinc-50 dark:bg-zinc-900/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full",
                        today && "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      )}
                    >
                      {format(d, "d")}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {events.slice(0, 3).map((e, i) => (
                      <span
                        key={i}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px]",
                          eventTone[e.kind]
                        )}
                        title={e.label}
                      >
                        {e.label}
                      </span>
                    ))}
                    {events.length > 3 && (
                      <span className="text-[10px] text-zinc-500">+{events.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-zinc-200 dark:bg-zinc-700" /> Holiday
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-blue-100 dark:bg-blue-900/50" /> Task
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-amber-100 dark:bg-amber-900/50" /> Follow-up
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm bg-violet-100 dark:bg-violet-900/50" /> Leave
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
