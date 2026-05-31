"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

const WORK_HOURS_START = 9;  // 9 AM IST
const WORK_HOURS_END = 20;   // 8 PM IST

function istHourNow(): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  return Number(fmt.format(new Date()));
}

function isWithinWorkHours(): boolean {
  const h = istHourNow();
  return h >= WORK_HOURS_START && h < WORK_HOURS_END;
}

export async function checkIn(formData: FormData) {
  const m = await getMyMembership();
  if (!m) throw new Error("Not in a team.");
  if (!isWithinWorkHours()) {
    throw new Error(
      `Check-in allowed only ${WORK_HOURS_START} AM – ${WORK_HOURS_END - 12} PM IST.`
    );
  }

  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Location not available.");
  }

  const leadIdRaw = String(formData.get("lead_id") ?? "").trim();
  const lead_id = leadIdRaw || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();

  // Prevent double-check-in: if there's an open visit, close the old one first
  await supabase
    .from("visits")
    .update({
      check_out_at: new Date().toISOString(),
      check_out_lat: lat,
      check_out_lng: lng,
    })
    .eq("member_id", m.id)
    .is("check_out_at", null);

  const { error } = await supabase.from("visits").insert({
    team_id: m.team_id,
    member_id: m.id,
    lead_id,
    check_in_lat: lat,
    check_in_lng: lng,
    notes,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/visits");
}

export async function checkOut(visitId: string, formData: FormData) {
  const m = await getMyMembership();
  if (!m) throw new Error("Not in a team.");

  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Location not available.");
  }
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();
  const update: Record<string, unknown> = {
    check_out_at: new Date().toISOString(),
    check_out_lat: lat,
    check_out_lng: lng,
  };
  if (notes) update.notes = notes;

  const { error } = await supabase
    .from("visits")
    .update(update)
    .eq("id", visitId)
    .eq("member_id", m.id);
  if (error) throw new Error(error.message);

  revalidatePath("/visits");
}

export async function deleteVisit(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("visits").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/visits");
}

// Quick-add a new customer (lead) from the check-in flow.
// Returns the new lead id so the client can immediately attach the visit.
export async function quickAddLead(formData: FormData): Promise<{ id: string }> {
  const m = await getMyMembership();
  if (!m) throw new Error("Not in a team.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Customer name is required.");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const latRaw = formData.get("lat");
  const lngRaw = formData.get("lng");
  const lat = latRaw ? Number(latRaw) : null;
  const lng = lngRaw ? Number(lngRaw) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      team_id: m.team_id,
      owner_id: m.id,
      name,
      phone,
      source: "visit",
      status: "new",
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/visits");
  revalidatePath("/leads");
  return { id: data.id as string };
}
