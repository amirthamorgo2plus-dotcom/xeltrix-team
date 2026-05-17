import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

export async function GET() {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("tasks")
      .select("title, description, due_at, priority, status, owner_id, related_type, related_id, created_at")
      .order("created_at", { ascending: false }),
    memberNameLookup(),
  ]);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []).map((t) => ({
    title: t.title,
    description: t.description,
    due_at: t.due_at,
    priority: t.priority,
    status: t.status,
    owner: members.get(t.owner_id) ?? null,
    related_type: t.related_type,
    related_id: t.related_id,
    created_at: t.created_at,
  }));

  const csv = toCsv(rows, [
    { key: "title", header: "Title" },
    { key: "description", header: "Description" },
    { key: "due_at", header: "Due" },
    { key: "priority", header: "Priority" },
    { key: "status", header: "Status" },
    { key: "owner", header: "Assignee" },
    { key: "related_type", header: "Related to" },
    { key: "related_id", header: "Related ID" },
    { key: "created_at", header: "Created" },
  ]);

  return csvResponse(csv, `tasks-${todayStamp()}.csv`);
}
