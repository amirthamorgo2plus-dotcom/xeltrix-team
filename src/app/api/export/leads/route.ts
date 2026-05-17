import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

export async function GET() {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("leads")
      .select("name, email, phone, source, status, notes, owner_id, created_at, updated_at")
      .order("created_at", { ascending: false }),
    memberNameLookup(),
  ]);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []).map((l) => ({
    name: l.name,
    email: l.email,
    phone: l.phone,
    source: l.source,
    status: l.status,
    owner: members.get(l.owner_id) ?? null,
    notes: l.notes,
    created_at: l.created_at,
    updated_at: l.updated_at,
  }));

  const csv = toCsv(rows, [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "source", header: "Source" },
    { key: "status", header: "Status" },
    { key: "owner", header: "Owner" },
    { key: "notes", header: "Notes" },
    { key: "created_at", header: "Created" },
    { key: "updated_at", header: "Updated" },
  ]);

  return csvResponse(csv, `leads-${todayStamp()}.csv`);
}
