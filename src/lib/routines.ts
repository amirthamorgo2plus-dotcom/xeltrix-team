import "server-only";
import {
  addDays,
  format,
  getDate,
  getISOWeek,
  getISOWeekYear,
  lastDayOfMonth,
  setDate,
  startOfWeek,
} from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Routine = {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  cadence: "daily" | "weekly" | "monthly";
  weekday: number | null;
  day_of_month: number | null;
  assignee_mode: "member" | "everyone";
  owner_id: string | null;
  per_person: boolean;
  priority: string;
  active: boolean;
};

// "Now" in IST (UTC+5:30) so period boundaries follow the business day in India.
function nowIST(): Date {
  return new Date(Date.now() + 330 * 60_000);
}

// Build an unambiguous due timestamp: the given IST calendar date at 18:00 IST.
function dueAtIso(istDate: Date): string {
  return `${format(istDate, "yyyy-MM-dd")}T18:00:00+05:30`;
}

// For a routine, the current period's key (used for dedupe) and due date.
function periodFor(r: Routine, ist: Date): { key: string; due: string } | null {
  if (r.cadence === "daily") {
    return { key: format(ist, "yyyy-MM-dd"), due: dueAtIso(ist) };
  }
  if (r.cadence === "weekly") {
    const wd = r.weekday ?? 1;
    // Date of the target weekday within this ISO week (Mon-anchored).
    const monday = startOfWeek(ist, { weekStartsOn: 1 });
    const offsetFromMonday = wd === 0 ? 6 : wd - 1; // Sun maps to end of week
    const due = addDays(monday, offsetFromMonday);
    return { key: `${getISOWeekYear(ist)}-W${getISOWeek(ist)}`, due: dueAtIso(due) };
  }
  if (r.cadence === "monthly") {
    const dom = Math.min(r.day_of_month ?? 1, getDate(lastDayOfMonth(ist)));
    const due = setDate(ist, dom);
    return { key: format(ist, "yyyy-MM"), due: dueAtIso(due) };
  }
  return null;
}

// Idempotently materialise the current period's instance for every active
// routine. Safe to call on every page load: the unique index + ignoreDuplicates
// means existing instances (including ones already marked done) are untouched.
export async function ensureRoutineInstances(
  supabase: SupabaseClient,
  teamId: string,
  activeMemberIds: string[]
): Promise<void> {
  const { data: routines } = await supabase
    .from("task_routines")
    .select(
      "id, team_id, title, description, cadence, weekday, day_of_month, assignee_mode, owner_id, per_person, priority, active"
    )
    .eq("team_id", teamId)
    .eq("active", true);

  if (!routines || routines.length === 0) return;

  const ist = nowIST();
  const rows: Record<string, unknown>[] = [];

  for (const r of routines as Routine[]) {
    const period = periodFor(r, ist);
    if (!period) continue;

    // Who gets an instance this period.
    let owners: string[];
    if (r.assignee_mode === "everyone" && r.per_person) {
      owners = activeMemberIds;
    } else {
      // member mode, or shared "everyone" — single responsible owner required.
      if (!r.owner_id) continue;
      owners = [r.owner_id];
    }

    for (const owner_id of owners) {
      rows.push({
        team_id: r.team_id,
        owner_id,
        title: r.title,
        description: r.description,
        priority: r.priority,
        status: "todo",
        due_at: period.due,
        routine_id: r.id,
        routine_period: period.key,
      });
    }
  }

  if (rows.length === 0) return;

  await supabase
    .from("tasks")
    .upsert(rows, {
      onConflict: "routine_id,owner_id,routine_period",
      ignoreDuplicates: true,
    });
}
