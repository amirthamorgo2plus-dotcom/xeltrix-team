"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

export async function createLead(_prev: { error?: string } | undefined, formData: FormData) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    team_id: m.team_id,
    owner_id: m.id,
    name,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    source: String(formData.get("source") ?? "").trim() || null,
    status: String(formData.get("status") ?? "new"),
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/leads");
  return {};
}

export async function updateLeadStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
}

// Accepts either "12.9716, 77.5946" (Google Maps right-click → copy) or a
// Google Maps URL containing @lat,lng or !3dlat!4dlng / q=lat,lng.
function parseLatLng(
  raw: string
): { lat: number; lng: number } | "clear" | null {
  const s = raw.trim();
  if (s === "") return "clear";

  const inRange = (lat: number, lng: number) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  // Google Maps URL: .../@12.97,77.59,17z  or  ?q=12.97,77.59  or !3d..!4d..
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const q = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  const d = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const m = at || q || d;
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }

  // Plain "lat, lng" (comma or whitespace separated)
  const pair = s.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (pair) {
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }
  return null;
}

// Manually set/clear a lead's exact coordinates. Paste "lat, lng" or a Google
// Maps link. Marks geocode_status='manual' so the auto-geocoder never
// overwrites a hand-placed pin.
export async function updateLeadLocation(
  id: string,
  raw: string
): Promise<{ error?: string }> {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team." };

  const parsed = parseLatLng(raw);
  if (parsed === null) {
    return { error: "Couldn't read coordinates. Use \"12.97, 77.59\" or a Google Maps link." };
  }

  const supabase = await createClient();
  const update =
    parsed === "clear"
      ? { latitude: null, longitude: null, geocode_status: null }
      : {
          latitude: parsed.lat,
          longitude: parsed.lng,
          geocode_status: "manual",
          geocoded_at: new Date().toISOString(),
        };

  const { error } = await supabase.from("leads").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/leads");
  revalidatePath("/visits");
  return {};
}
