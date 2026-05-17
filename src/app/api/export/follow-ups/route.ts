import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

export async function GET() {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("due_at, channel, notes, done_at, owner_id, lead:leads(name)")
      .order("due_at", { ascending: false }),
    memberNameLookup(),
  ]);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []).map((f) => {
    const lead = Array.isArray(f.lead)
      ? (f.lead as { name?: string }[])[0]
      : (f.lead as { name?: string } | null);
    return {
      lead: lead?.name ?? null,
      due_at: f.due_at,
      channel: f.channel,
      notes: f.notes,
      owner: members.get(f.owner_id) ?? null,
      done_at: f.done_at,
    };
  });

  const csv = toCsv(rows, [
    { key: "lead", header: "Lead" },
    { key: "due_at", header: "Due" },
    { key: "channel", header: "Channel" },
    { key: "notes", header: "Notes" },
    { key: "owner", header: "Owner" },
    { key: "done_at", header: "Done at" },
  ]);

  return csvResponse(csv, `follow-ups-${todayStamp()}.csv`);
}
