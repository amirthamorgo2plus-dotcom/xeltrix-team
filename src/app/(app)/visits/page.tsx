import Link from "next/link";
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

function todayIsoIST(): string {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return istNow.toISOString().slice(0, 10);
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; member?: string }>;
}) {
  const sp = await searchParams;
  const me = await getMyMembership();
  const members = await getTeamMembers();

  const dateFilter = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIsoIST();
  const memberFilter = sp.member && sp.member !== "all" ? sp.member : null;
  const isToday = dateFilter === todayIsoIST();

  // Build day window in IST -> UTC ISO
  const dayStartUtc = new Date(`${dateFilter}T00:00:00+05:30`).toISOString();
  const dayEndUtc = new Date(`${dateFilter}T23:59:59+05:30`).toISOString();

  const supabase = await createClient();

  let visitsQuery = supabase
    .from("visits")
    .select(
      "id, member_id, lead_id, check_in_at, check_in_lat, check_in_lng, check_out_at, check_out_lat, check_out_lng, notes"
    )
    .gte("check_in_at", dayStartUtc)
    .lte("check_in_at", dayEndUtc)
    .order("check_in_at", { ascending: false });
  if (memberFilter) visitsQuery = visitsQuery.eq("member_id", memberFilter);

  const [{ data: visits }, { data: leads }] = await Promise.all([
    visitsQuery,
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
  const memberOptions = members.map((mm) => {
    const profile = (mm.profiles as unknown) as { full_name?: string } | null;
    return { id: mm.id, name: profile?.full_name || "(unnamed)" };
  });

  const leadInfo = new Map(
    (leads ?? []).map((l) => [l.id, l.name as string])
  );

  // Always check for the CURRENT user's open visit regardless of filters
  const { data: activeRows } = await supabase
    .from("visits")
    .select(
      "id, member_id, lead_id, check_in_at, check_in_lat, check_in_lng, check_out_at, check_out_lat, check_out_lng, notes"
    )
    .eq("member_id", me?.id ?? "")
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .limit(1);
  const myActiveVisit = activeRows?.[0] as Visit | undefined;

  // Build map pins from the filtered visits
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
        paired:
          outLat != null && outLng != null ? { lat: outLat, lng: outLng } : null,
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

  function buildUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    const date = "date" in overrides ? overrides.date : dateFilter;
    const member = "member" in overrides ? overrides.member : memberFilter;
    if (date && date !== todayIsoIST()) params.set("date", date);
    if (member) params.set("member", member);
    const qs = params.toString();
    return `/visits${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Visits</h1>
        <p className="text-sm text-zinc-500">
          {isToday ? "Today" : format(new Date(`${dateFilter}T00:00:00`), "EEE, dd MMM yyyy")}
          {memberFilter
            ? ` · ${memberInfo.get(memberFilter)?.name ?? "member"}`
            : " · whole team"}
          {" · "}
          {(visits ?? []).length} visit{(visits ?? []).length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Filters */}
      <form
        action="/visits"
        className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={dateFilter}
            className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Employee</label>
          <select
            name="member"
            defaultValue={memberFilter ?? "all"}
            suppressHydrationWarning
            className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
          >
            <option value="all">All employees</option>
            {memberOptions.map((mo) => (
              <option key={mo.id} value={mo.id}>
                {mo.name}
              </option>
            ))}
          </select>
        </div>
        <button className="h-9 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900">
          Apply
        </button>
        {(memberFilter || !isToday) && (
          <Link
            href={buildUrl({ date: null, member: null })}
            className="h-9 inline-flex items-center rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Clear · today &amp; everyone
          </Link>
        )}
      </form>

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
        isToday && <CheckInButton leads={leadOptions} workHours={WORK_HOURS} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Map · {isToday ? "today" : format(new Date(`${dateFilter}T00:00:00`), "dd MMM")}</CardTitle>
        </CardHeader>
        <CardContent>
          {pins.length === 0 ? (
            <EmptyState
              title="No visits for this filter"
              hint={isToday ? "Pins appear here once team members check in." : "Try a different date."}
            />
          ) : (
            <VisitMap pins={pins} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visit list</CardTitle>
        </CardHeader>
        <CardContent>
          {(visits ?? []).length === 0 ? (
            <EmptyState title="No visits logged for this filter" />
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
