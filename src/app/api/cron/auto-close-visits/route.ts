import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

// 8 PM IST = 14:30 UTC daily.
// Cron in vercel.json: "30 14 * * *"
export const maxDuration = 30;

const WORK_END_HOUR_IST = 20;

export async function GET(req: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sb = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Today's 8 PM IST in UTC = current date 14:30 UTC
  const now = new Date();
  // Build "today 20:00 IST" as ISO UTC
  // IST = UTC + 5:30. So today 20:00 IST = today 14:30 UTC.
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const istDateStr = istNow.toISOString().slice(0, 10); // yyyy-mm-dd in IST
  const closeAtUtc = new Date(`${istDateStr}T${String(WORK_END_HOUR_IST).padStart(2, "0")}:00:00+05:30`);
  const dayStartUtc = new Date(`${istDateStr}T00:00:00+05:30`);

  const { data: openVisits, error: fetchErr } = await sb
    .from("visits")
    .select("id, check_in_at, check_in_lat, check_in_lng, notes, member_id")
    .is("check_out_at", null)
    .gte("check_in_at", dayStartUtc.toISOString())
    .lte("check_in_at", closeAtUtc.toISOString());

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!openVisits || openVisits.length === 0) {
    return NextResponse.json({ closed: 0 });
  }

  // Auto-close each: end-time = 8 PM IST, end-location = check-in location
  for (const v of openVisits) {
    const tag = "auto-closed at 8 PM";
    const newNotes = v.notes ? `${v.notes} | ${tag}` : tag;
    await sb
      .from("visits")
      .update({
        check_out_at: closeAtUtc.toISOString(),
        check_out_lat: v.check_in_lat,
        check_out_lng: v.check_in_lng,
        notes: newNotes,
      })
      .eq("id", v.id);
  }

  return NextResponse.json({ closed: openVisits.length });
}
