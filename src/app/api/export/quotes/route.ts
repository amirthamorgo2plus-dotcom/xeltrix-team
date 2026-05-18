import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";

export async function GET() {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "number, customer_name, status, value, currency, date, expiry_date, owner_id, notes, zoho_salesperson_name"
      )
      .order("date", { ascending: false }),
    memberNameLookup(),
  ]);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []).map((q) => ({
    number: q.number,
    customer: q.customer_name,
    salesperson: q.zoho_salesperson_name,
    status: q.status,
    value: q.value,
    currency: q.currency,
    date: q.date,
    expiry_date: q.expiry_date,
    owner: members.get(q.owner_id) ?? null,
    notes: q.notes,
  }));

  const csv = toCsv(rows, [
    { key: "number", header: "Number" },
    { key: "customer", header: "Customer" },
    { key: "salesperson", header: "Salesperson" },
    { key: "status", header: "Status" },
    { key: "value", header: "Value" },
    { key: "currency", header: "Currency" },
    { key: "date", header: "Date" },
    { key: "expiry_date", header: "Expiry" },
    { key: "owner", header: "Owner" },
    { key: "notes", header: "Notes" },
  ]);

  return csvResponse(csv, `quotes-${todayStamp()}.csv`);
}
