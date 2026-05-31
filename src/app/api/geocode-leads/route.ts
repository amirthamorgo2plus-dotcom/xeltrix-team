import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSbAdmin } from "@supabase/supabase-js";

export const maxDuration = 60; // batch geocode is paced ~1 req/sec

const BATCH = 20;
const DELAY_MS = 1100; // Nominatim usage policy: max ~1 request/second

function adminClient() {
  return createSbAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=" +
    encodeURIComponent(address);
  const res = await fetch(url, {
    headers: {
      // Nominatim requires a descriptive User-Agent identifying the app.
      "User-Agent": "xeltrix-team/1.0 (https://xeltrix-team.vercel.app)",
      "Accept-Language": "en",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function countPending(
  sb: ReturnType<typeof adminClient>,
  teamId: string
): Promise<number> {
  const { count } = await sb
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .is("latitude", null)
    .is("geocode_status", null)
    .not("address", "is", null);
  return count ?? 0;
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase
    .from("team_members")
    .select("role, team_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!m || (m.role !== "admin" && m.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sb = adminClient();

  // A batch with an address but no coordinates, not yet attempted.
  const { data: pending, error } = await sb
    .from("leads")
    .select("id, address")
    .eq("team_id", m.team_id)
    .is("latitude", null)
    .is("geocode_status", null)
    .not("address", "is", null)
    .limit(BATCH);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  let ok = 0;
  let failed = 0;
  const list = pending ?? [];
  for (let i = 0; i < list.length; i++) {
    if (i > 0) await sleep(DELAY_MS); // respect rate limit between calls
    let coords: { lat: number; lng: number } | null = null;
    try {
      coords = await geocode(String(list[i].address));
    } catch {
      coords = null;
    }
    if (coords) {
      await sb
        .from("leads")
        .update({
          latitude: coords.lat,
          longitude: coords.lng,
          geocoded_at: new Date().toISOString(),
          geocode_status: "ok",
        })
        .eq("id", list[i].id);
      ok++;
    } else {
      await sb
        .from("leads")
        .update({
          geocoded_at: new Date().toISOString(),
          geocode_status: "failed",
        })
        .eq("id", list[i].id);
      failed++;
    }
  }

  const remaining = await countPending(sb, m.team_id);
  return NextResponse.json({ processed: list.length, ok, failed, remaining });
}
