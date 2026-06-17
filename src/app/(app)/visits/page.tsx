import Link from "next/link";
import { format, differenceInMinutes } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership, getTeamMembers, isAdminOrManager } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { CheckInButton } from "./check-in-button";
import { CheckOutButton } from "./check-out-button";
import { LocationTest } from "./location-test";
import { VisitMap } from "./visit-map";
import { VisitRowActions } from "./visit-row-actions";
import { GeocodeCustomersButton } from "./geocode-customers-button";
import type { MapPin } from "./visit-map-impl";

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

// Straight-line distance between two coords, in km.
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtDuration(mins: number): string {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function todayIsoIST(): string {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return istNow.toISOString().slice(0, 10);
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; member?: string; customers?: string }>;
}) {
  const sp = await searchParams;
  const me = await getMyMembership();
  const teamId = me?.team_id ?? "00000000-0000-0000-0000-000000000000";
  const canManage = isAdminOrManager(me?.role);
  const members = await getTeamMembers();

  const dateFilter = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayIsoIST();
  const memberFilter = sp.member && sp.member !== "all" ? sp.member : null;
  const isToday = dateFilter === todayIsoIST();
  const showCustomers = sp.customers === "1";

  // Build day window in IST -> UTC ISO
  const dayStartUtc = new Date(`${dateFilter}T00:00:00+05:30`).toISOString();
  const dayEndUtc = new Date(`${dateFilter}T23:59:59+05:30`).toISOString();

  const supabase = await createClient();

  let visitsQuery = supabase
    .from("visits")
    .select(
      "id, member_id, lead_id, check_in_at, check_in_lat, check_in_lng, check_out_at, check_out_lat, check_out_lng, notes"
    )
    .eq("team_id", teamId)
    .gte("check_in_at", dayStartUtc)
    .lte("check_in_at", dayEndUtc)
    .order("check_in_at", { ascending: false });
  if (memberFilter) visitsQuery = visitsQuery.eq("member_id", memberFilter);

  const [{ data: visits }, { data: leads }] = await Promise.all([
    visitsQuery,
    supabase
      .from("leads")
      .select("id, name, latitude, longitude")
      .eq("team_id", teamId)
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
    .eq("team_id", teamId)
    .eq("member_id", me?.id ?? "")
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .limit(1);
  const myActiveVisit = activeRows?.[0] as Visit | undefined;

  // In route mode (a single employee selected), order the day's visits
  // chronologically, number them, and connect them into a route.
  const routeMode = !!memberFilter;
  const chrono = [...(visits ?? [])].sort(
    (a, b) =>
      new Date(a.check_in_at).getTime() - new Date(b.check_in_at).getTime()
  ) as Visit[];

  const pins = (routeMode ? chrono : visits ?? [])
    .map((v: Visit, i: number) => {
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
        order: routeMode ? i + 1 : undefined,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      lat: number;
      lng: number;
      label: string;
      subtitle: string;
      paired: { lat: number; lng: number } | null;
      order?: number;
    }>;

  const routePath: Array<[number, number]> = routeMode
    ? pins.map((p) => [p.lat, p.lng] as [number, number])
    : [];

  // Route efficiency stats (only meaningful for a single employee's day).
  let routeKm = 0;
  for (let i = 1; i < pins.length; i++) {
    routeKm += haversineKm(pins[i - 1], pins[i]);
  }
  const onSiteMins = chrono.reduce(
    (s, v) =>
      v.check_out_at
        ? s +
          differenceInMinutes(new Date(v.check_out_at), new Date(v.check_in_at))
        : s,
    0
  );
  const firstIn = chrono.length ? new Date(chrono[0].check_in_at) : null;
  const lastOut = chrono.length
    ? new Date(
        chrono[chrono.length - 1].check_out_at ?? new Date().toISOString()
      )
    : null;
  const spanMins =
    firstIn && lastOut ? Math.max(0, differenceInMinutes(lastOut, firstIn)) : 0;
  const offSiteMins = Math.max(0, spanMins - onSiteMins);

  const leadOptions = (leads ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    latitude: num(l.latitude as number | string | null),
    longitude: num(l.longitude as number | string | null),
  }));

  const customerPins: MapPin[] = showCustomers
    ? leadOptions
        .filter((l) => l.latitude != null && l.longitude != null)
        .map((l) => ({
          id: `cust-${l.id}`,
          lat: l.latitude as number,
          lng: l.longitude as number,
          label: l.name,
          kind: "customer" as const,
        }))
    : [];
  const allPins: MapPin[] = showCustomers ? [...customerPins, ...pins] : pins;

  let pendingGeocode = 0;
  let failedGeocode = 0;
  if (canManage) {
    const [{ count: pendingCount }, { count: failedCount }] = await Promise.all([
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .is("latitude", null)
        .is("geocode_status", null)
        .not("address", "is", null),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
        .is("latitude", null)
        .eq("geocode_status", "failed"),
    ]);
    pendingGeocode = pendingCount ?? 0;
    failedGeocode = failedCount ?? 0;
  }

  function buildUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    const date = "date" in overrides ? overrides.date : dateFilter;
    const member = "member" in overrides ? overrides.member : memberFilter;
    const customers =
      "customers" in overrides
        ? overrides.customers
        : showCustomers
          ? "1"
          : null;
    if (date && date !== todayIsoIST()) params.set("date", date);
    if (member) params.set("member", member);
    if (customers) params.set("customers", customers);
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

      {/* Tabs */}
      <div className="inline-flex rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href="/visits"
          className="rounded bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          Daily
        </Link>
        <Link
          href="/visits/summary"
          className="rounded px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Monthly summary
        </Link>
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

      {isToday && (
        <Card>
          <CardHeader>
            <CardTitle>Trouble checking in?</CardTitle>
            <p className="text-xs text-zinc-500">
              Verify your phone shares location (handy on iPhone) without doing a real check-in.
            </p>
          </CardHeader>
          <CardContent>
            <LocationTest />
          </CardContent>
        </Card>
      )}

      {routeMode && pins.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Route · {memberInfo.get(memberFilter!)?.name ?? "member"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-2xl font-semibold">{pins.length}</div>
                <div className="text-xs text-zinc-500">Stops</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {routeKm.toFixed(1)} km
                </div>
                <div className="text-xs text-zinc-500">
                  Route distance (approx)
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {fmtDuration(onSiteMins)}
                </div>
                <div className="text-xs text-zinc-500">Time on site</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {fmtDuration(offSiteMins)}
                </div>
                <div className="text-xs text-zinc-500">Travel + idle</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              Distance is straight-line between consecutive check-ins (not road
              distance). Numbered pins show the visit order, so a zig-zag route
              or long travel/idle time stands out.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {routeMode ? "Route map" : "Map"} ·{" "}
            {isToday
              ? "today"
              : format(new Date(`${dateFilter}T00:00:00`), "dd MMM")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={buildUrl({ customers: showCustomers ? null : "1" })}
              className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-3 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {showCustomers ? "Hide customers" : "Show all customers"}
            </Link>
            {canManage && (
              <GeocodeCustomersButton
                pending={pendingGeocode}
                failed={failedGeocode}
              />
            )}
          </div>
          {allPins.length === 0 ? (
            <EmptyState
              title="Nothing to show for this filter"
              hint={
                isToday
                  ? "Pins appear here once team members check in."
                  : "Try a different date, or toggle customers on."
              }
            />
          ) : (
            <VisitMap
              pins={allPins}
              routePath={routeMode ? routePath : undefined}
            />
          )}
          {!routeMode && (
            <p className="text-xs text-zinc-400">
              Tip: pick one employee above to see their numbered route and
              travel stats. Amber shop pins are customer locations.
            </p>
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
                      {canManage && (
                        <div className="mt-2">
                          <VisitRowActions
                            visitId={v.id}
                            defaults={{
                              lead_id: v.lead_id,
                              notes: v.notes,
                              check_in_at: v.check_in_at,
                              check_out_at: v.check_out_at,
                            }}
                            leads={leadOptions.map((l) => ({ id: l.id, name: l.name }))}
                          />
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
