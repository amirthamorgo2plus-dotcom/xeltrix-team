import { format, differenceInMinutes } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { CheckInButton } from "./check-in-button";
import { CheckOutButton } from "./check-out-button";
import { VisitMap } from "./visit-map";

const WORK_HOURS = { start: 9, end: 20 };

type Visit = {
  id: string;
  member_id: string;
  lead_id: string | null;
  check_in_at: string;
  check_in_lat: number | string;
  check_in_lng: number | string;
  check_out_at: string | null;
  check_out_lat: number | string | null;
  check_out_lng: number | string | null;
  notes: string | null;
};

function num(v: number | string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function VisitsPage() {
  const me = await getMyMembership();
  const members = await getTeamMembers();

  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ data: visits }, { data: leads }] = await Promise.all([
    supabase
      .from("visits")
      .select(
        "id, member_id, lead_id, check_in_at, check_in_lat, check_in_lng, check_out_at, check_out_lat, check_out_lng, notes"
      )
      .gte("check_in_at", todayStart.toISOString())
      .order("check_in_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id, name, latitude, longitude")
      .order("name")
      .limit(500),
  ]);

  const memberInfo = new Map(
    members.map((mm) => {
      const profile = (mm.profiles as unknown) as {
        full_name?: string;
        avatar_url?: string;
      } | null;
      return [
        mm.id,
        {
          name: profile?.full_name || "(unnamed)",
          avatar_url: profile?.avatar_url ?? null,
        },
      ];
    })
  );

  const leadInfo = new Map(
    (leads ?? []).map((l) => [l.id, l.name as string])
  );

  const myActiveVisit = (visits ?? []).find(
    (v) => v.member_id === me?.id && !v.check_out_at
  );

  // Build map pins from today's visits
  const pins = (visits ?? [])
    .map((v: Visit) => {
      const lat = num(v.check_in_lat);
      const lng = num(v.check_in_lng);
      if (lat == null || lng == null) return null;
      const memberName = memberInfo.get(v.member_id)?.name ?? "?";
      const leadName = v.lead_id ? leadInfo.get(v.lead_id) ?? "" : "";
      const outLat = num(v.check_out_lat);
      const outLng = num(v.check_out_lng);
      return {
        id: v.id,
        lat,
        lng,
        label: leadName || "Check-in",
        subtitle: `${memberName} · ${format(new Date(v.check_in_at), "HH:mm")}`,
        paired: outLat != null && outLng != null ? { lat: outLat, lng: outLng } : null,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      lat: number;
      lng: number;
      label: string;
      subtitle: string;
      paired: { lat: number; lng: number } | null;
    }>;

  const leadOptions = (leads ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    latitude: num(l.latitude as number | string | null),
    longitude: num(l.longitude as number | string | null),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Visits</h1>
        <p className="text-sm text-zinc-500">
          Field check-ins · today · {(visits ?? []).length} visit
          {(visits ?? []).length === 1 ? "" : "s"}
        </p>
      </div>

      {myActiveVisit ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>You are checked in</span>
              <Badge tone="success">on site</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="text-sm">
              {myActiveVisit.lead_id ? (
                <span>
                  At <strong>{leadInfo.get(myActiveVisit.lead_id) ?? "customer"}</strong>{" "}
                </span>
              ) : (
                <span>(no customer linked) </span>
              )}
              since {format(new Date(myActiveVisit.check_in_at), "dd MMM, HH:mm")}{" "}
              ({differenceInMinutes(new Date(), new Date(myActiveVisit.check_in_at))} min ago)
            </div>
            {myActiveVisit.notes && (
              <div className="text-xs text-zinc-500">{myActiveVisit.notes}</div>
            )}
            <CheckOutButton visitId={myActiveVisit.id} />
          </CardContent>
        </Card>
      ) : (
        <CheckInButton leads={leadOptions} workHours={WORK_HOURS} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Map · today</CardTitle>
        </CardHeader>
        <CardContent>
          {pins.length === 0 ? (
            <EmptyState
              title="No visits yet today"
              hint="Pins appear here once team members check in."
            />
          ) : (
            <VisitMap pins={pins} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s visits</CardTitle>
        </CardHeader>
        <CardContent>
          {(visits ?? []).length === 0 ? (
            <EmptyState title="No visits logged yet today" />
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {(visits ?? []).map((v: Visit) => {
                const member = memberInfo.get(v.member_id);
                const leadName = v.lead_id ? leadInfo.get(v.lead_id) : null;
                const open = !v.check_out_at;
                const mins = v.check_out_at
                  ? differenceInMinutes(
                      new Date(v.check_out_at),
                      new Date(v.check_in_at)
                    )
                  : differenceInMinutes(new Date(), new Date(v.check_in_at));
                return (
                  <li key={v.id} className="flex items-start gap-3 py-3">
                    <Avatar
                      src={member?.avatar_url ?? null}
                      name={member?.name}
                      size={28}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{member?.name}</span>
                        <span className="text-zinc-500">·</span>
                        <span>
                          {leadName ? leadName : <em className="text-zinc-500">no customer</em>}
                        </span>
                        {open ? (
                          <Badge tone="success">on site</Badge>
                        ) : (
                          <Badge tone="muted">{mins} min</Badge>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Check-in {format(new Date(v.check_in_at), "HH:mm")}
                        {v.check_out_at && (
                          <>
                            {" → "}check-out{" "}
                            {format(new Date(v.check_out_at), "HH:mm")}
                          </>
                        )}
                      </div>
                      {v.notes && (
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                          {v.notes}
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
