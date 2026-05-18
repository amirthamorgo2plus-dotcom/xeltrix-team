import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { requireUser } from "@/lib/export-helpers";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const supabase = await createClient();
  const [{ data: items }, { data: payments, error }] = await Promise.all([
    supabase
      .from("expense_items")
      .select("id, name, category, frequency, budget"),
    supabase
      .from("expense_payments")
      .select("item_id, month, actual, paid_on, note")
      .gte("month", yearStart)
      .lte("month", yearEnd)
      .order("month"),
  ]);

  if (error) return new Response(error.message, { status: 500 });

  const itemMap = new Map((items ?? []).map((it) => [it.id, it]));
  const rows = (payments ?? []).map((p) => {
    const it = itemMap.get(p.item_id);
    return {
      month: p.month,
      item: it?.name ?? "(unknown)",
      category: it?.category ?? "",
      frequency: it?.frequency ?? "",
      budget: it?.budget ?? 0,
      actual: p.actual,
      variance: Number(it?.budget ?? 0) - Number(p.actual ?? 0),
      paid_on: p.paid_on,
      note: p.note,
    };
  });

  const csv = toCsv(rows, [
    { key: "month", header: "Month" },
    { key: "item", header: "Item" },
    { key: "category", header: "Category" },
    { key: "frequency", header: "Frequency" },
    { key: "budget", header: "Budget" },
    { key: "actual", header: "Actual" },
    { key: "variance", header: "Variance" },
    { key: "paid_on", header: "Paid on" },
    { key: "note", header: "Note" },
  ]);

  return csvResponse(csv, `payments-${year}-${todayStamp()}.csv`);
}
