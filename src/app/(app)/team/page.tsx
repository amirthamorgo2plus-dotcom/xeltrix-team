import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TeamManager, type TeamMemberRow } from "./team-manager";

export default async function TeamPage() {
  const me = await getMyMembership();
  if (!isAdminOrManager(me?.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("team_members")
    .select("id, user_id, role, active, track_attendance, attendance_only")
    .eq("team_id", me!.team_id)
    .order("active", { ascending: false })
    .order("role");

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));

  const rows: TeamMemberRow[] = (members ?? []).map((m) => ({
    id: m.id,
    name: nameById.get(m.user_id) || "(unnamed)",
    role: m.role,
    active: m.active,
    track_attendance: m.track_attendance !== false,
    attendance_only: m.attendance_only === true,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Team members</h1>
        <p className="text-sm text-zinc-500">
          Hide salesperson buckets from attendance, deactivate people who&apos;ve left, and add
          attendance-only staff who have no email.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState title="No members" />
          ) : (
            <TeamManager members={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
