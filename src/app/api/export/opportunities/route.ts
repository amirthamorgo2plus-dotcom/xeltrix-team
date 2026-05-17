import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

export async function GET() {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("opportunities")
      .select("title, value, stage, close_date, probability, lead_id, owner_id, created_at, leads:leads(name)")
      .order("created_at", { ascending: false }),
    memberNameLookup(),
  ]);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []).map((o) => {
    const lead = Array.isArray(o.leads)
      ? (o.leads as { name?: string }[])[0]
      : (o.leads as { name?: string } | null);
    return {
      title: o.title,
      value: o.value,
      stage: o.stage,
      close_date: o.close_date,
      probability: o.probability,
      lead: lead?.name ?? null,
      owner: members.get(o.owner_id) ?? null,
      created_at: o.created_at,
    };
  });

  const csv = toCsv(rows, [
    { key: "title", header: "Title" },
    { key: "value", header: "Value" },
    { key: "stage", header: "Stage" },
    { key: "close_date", header: "Close date" },
    { key: "probability", header: "Probability %" },
    { key: "lead", header: "Lead" },
    { key: "owner", header: "Owner" },
    { key: "created_at", header: "Created" },
  ]);

  return csvResponse(csv, `opportunities-${todayStamp()}.csv`);
}
