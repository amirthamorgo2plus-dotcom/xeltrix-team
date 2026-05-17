"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function computeHours(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round((ms / 3600000) * 100) / 100);
}

export async function checkIn() {
  const m = await getMyMembership();
  if (!m) throw new Error("Not in a team");

  const supabase = await createClient();
  const now = new Date().toISOString();
  const date = todayIso();

  // If a row already exists, treat as no-op (idempotent check-in)
  const { data: existing } = await supabase
    .from("attendance")
    .select("id, check_in_at")
    .eq("member_id", m.id)
    .eq("date", date)
    .maybeSingle();

  if (existing?.check_in_at) {
    revalidatePath("/attendance");
    return;
  }

  if (existing) {
    await supabase
      .from("attendance")
      .update({ check_in_at: now, status: existing ? "present" : "present" })
      .eq("id", existing.id);
  } else {
    // Default status — trigger may re-classify if today is an off-day
    const isOff = await isOffDay(m.team_id, date);
    await supabase.from("attendance").insert({
      member_id: m.id,
      date,
      status: isOff ? "holiday_worked" : "present",
      check_in_at: now,
    });
  }

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}

export async function checkOut() {
  const m = await getMyMembership();
  if (!m) throw new Error("Not in a team");

  const supabase = await createClient();
  const now = new Date().toISOString();
  const date = todayIso();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id, check_in_at, check_out_at")
    .eq("member_id", m.id)
    .eq("date", date)
    .maybeSingle();

  if (!existing?.check_in_at) throw new Error("Check in first.");

  const hours = computeHours(existing.check_in_at, now);
  await supabase
    .from("attendance")
    .update({ check_out_at: now, hours })
    .eq("id", existing.id);

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
}

async function isOffDay(team_id: string, date: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_working_day", { p_team: team_id, p_date: date });
  return data === false;
}

export async function markAttendance(
  _prev: { error?: string } | undefined,
  formData: FormData
) {
  const m = await getMyMembership();
  if (!m) return { error: "Not in a team" };
  if (m.role !== "admin" && m.role !== "manager") {
    return { error: "Only admin/manager can mark on behalf." };
  }

  const member_id = String(formData.get("member_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const status = String(formData.get("status") ?? "");
  const hours = formData.get("hours") ? Number(formData.get("hours")) : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!member_id || !date || !status) return { error: "Member, date, and status are required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .upsert(
      { member_id, date, status, hours, note },
      { onConflict: "member_id,date" }
    );

  if (error) return { error: error.message };
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return {};
}
