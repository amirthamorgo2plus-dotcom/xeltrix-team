import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RoutineForm } from "./routine-form";
import { RoutineRow } from "./routine-row";

export default async function RoutinesPage() {
  const me = await getMyMembership();
  if (!isAdminOrManager(me?.role)) redirect("/tasks");

  const teamMembers = await getTeamMembers();
  const memberOpts = teamMembers.map((m) => {
    const profile = (m.profiles as unknown) as { full_name?: string } | null;
    return { id: m.id, name: profile?.full_name || "(unnamed)" };
  });
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
                {routines.map((r) => (
                  <RoutineRow key={r.id} routine={r} members={memberOpts} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
