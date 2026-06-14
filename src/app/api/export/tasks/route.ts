import { isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

// Mirrors the Tasks page buckets so a filtered export matches what's on screen.
function matchesStatus(status: string, due_at: string | null, filter: string): boolean {
  const isDone = status === "done" || status === "cancelled";
  if (filter === "done") return isDone;
  if (isDone) return false; // remaining filters are all "pending" subsets
  if (filter === "pending") return true;
  if (!due_at) return filter === "upcoming";
  const due = new Date(due_at);
  if (filter === "overdue") return isPast(due) && !isToday(due);
  if (filter === "today") return isToday(due);
  if (filter === "upcoming") return !(isPast(due) && !isToday(due)) && !isToday(due);
  return true;
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const member = searchParams.get("member");
  const status = searchParams.get("status") ?? "all";

  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("title, description, due_at, priority, status, owner_id, related_type, related_id, created_at")
    .order("created_at", { ascending: false });
  if (member && member !== "all") query = query.eq("owner_id", member);

  const [{ data, error }, members] = await Promise.all([query, memberNameLookup()]);
  if (error) return new Response(error.message, { status: 500 });

  const filtered = (data ?? []).filter((t) =>
    status === "all" ? true : matchesStatus(t.status as string, t.due_at as string | null, status)
  );

  const rows = filtered.map((t) => ({
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
