import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

export async function GET() {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("complaints")
      .select("customer_name, customer_email, subject, description, severity, status, owner_id, opened_at, resolved_at")
      .order("opened_at", { ascending: false }),
    memberNameLookup(),
  ]);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []).map((c) => ({
    customer_name: c.customer_name,
    customer_email: c.customer_email,
    subject: c.subject,
    description: c.description,
    severity: c.severity,
    status: c.status,
    owner: members.get(c.owner_id) ?? null,
    opened_at: c.opened_at,
    resolved_at: c.resolved_at,
  }));

  const csv = toCsv(rows, [
    { key: "customer_name", header: "Customer" },
    { key: "customer_email", header: "Customer email" },
    { key: "subject", header: "Subject" },
    { key: "description", header: "Description" },
    { key: "severity", header: "Severity" },
    { key: "status", header: "Status" },
    { key: "owner", header: "Owner" },
    { key: "opened_at", header: "Opened" },
    { key: "resolved_at", header: "Resolved" },
  ]);

  return csvResponse(csv, `complaints-${todayStamp()}.csv`);
}
