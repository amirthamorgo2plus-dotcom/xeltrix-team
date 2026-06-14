import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { RoutineForm } from "./routine-form";
import { RoutineRowActions } from "./routine-row-actions";

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cadenceLabel(r: {
  cadence: string;
  weekday: number | null;
  day_of_month: number | null;
}) {
  if (r.cadence === "weekly") return `Weekly · ${WEEKDAY_LABEL[r.weekday ?? 1]}`;
  if (r.cadence === "monthly") return `Monthly · day ${r.day_of_month ?? 1}`;
  return "Daily";
}

export default async function RoutinesPage() {
  const me = await getMyMembership();
  if (!isAdminOrManager(me?.role)) redirect("/tasks");

  const teamMembers = await getTeamMembers();
  const memberOpts = teamMembers.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    return { id: m.id, name: profile?.full_name || "(unnamed)" };
  });
  const memberById = new Map(memberOpts.map((m) => [m.id, m.name]));

  const supabase = await createClient();
  const { data: routines } = await supabase
    .from("task_routines")
    .select("id, title, description, cadence, weekday, day_of_month, assignee_mode, owner_id, per_person, priority, active")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Routines</h1>
        <p className="text-sm text-zinc-500">
          Recurring duties that generate a fresh task each period (meetings, social uploads,
          follow-ups).
        </p>
      </div>

      <RoutineForm members={memberOpts} />

      <Card>
        <CardHeader>
          <CardTitle>All routines</CardTitle>
        </CardHeader>
        <CardContent>
          {!routines || routines.length === 0 ? (
            <EmptyState title="No routines yet" hint="Add one above." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="pb-2 pr-4">Routine</th>
                  <th className="pb-2 pr-4">Repeats</th>
                  <th className="pb-2 pr-4">Assigned</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {routines.map((r) => {
                  const assigned =
                    r.assignee_mode === "everyone" && r.per_person
                      ? "Everyone (per person)"
                      : memberById.get(r.owner_id as string) ?? "—";
                  return (
                    <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{r.title}</div>
                        {r.description && (
                          <div className="text-xs text-zinc-500">{r.description}</div>
                        )}
                      </td>
                      <td className="py-2 pr-4">{cadenceLabel(r)}</td>
                      <td className="py-2 pr-4">{assigned}</td>
                      <td className="py-2 pr-4">
                        <Badge tone={r.active ? "success" : "muted"}>
                          {r.active ? "Active" : "Paused"}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <RoutineRowActions id={r.id} active={r.active} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
