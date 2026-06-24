import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { memberNameLookup, requireUser } from "@/lib/export-helpers";
import { differenceInDays, parseISO } from "date-fns";

function agingLabel(dueDateStr: string | null): string {
  if (!dueDateStr) return "Current";
  const days = differenceInDays(new Date(), parseISO(dueDateStr));
  if (days <= 0) return "Current";
  if (days <= 15) return "1-15 days";
  if (days <= 30) return "16-30 days";
  if (days <= 45) return "31-45 days";
  return ">45 days";
}

export async function GET() {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("opportunities")
      .select("title, value, balance_due, due_date, invoice_status, zoho_salesperson_name, owner_id, lead:leads(name, phone)")
      .eq("stage", "won")
      .gt("balance_due", 0)
      .order("due_date", { ascending: true, nullsFirst: false }),
    memberNameLookup(),
  ]);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []).map((o) => {
    const lead = Array.isArray(o.lead) ? o.lead[0] : o.lead;
    const titleParts = (o.title ?? "").split("·");
    const invoiceNo = titleParts[0]?.trim() ?? "";
    const customer = lead?.name ?? (titleParts.length > 1 ? titleParts.slice(1).join("·").trim() : o.title);
    return {
      invoice: invoiceNo,
      customer,
      phone: lead?.phone ?? "",
      total: o.value,
      balance_due: o.balance_due,
      due_date: o.due_date ?? "",
      aging: agingLabel(o.due_date),
      salesperson: o.zoho_salesperson_name ?? members.get(o.owner_id) ?? "",
      status: o.invoice_status ?? "",
    };
  });

  const csv = toCsv(rows, [
    { key: "invoice",    header: "Invoice #" },
    { key: "customer",   header: "Customer" },
    { key: "phone",      header: "Phone" },
    { key: "total",      header: "Total" },
    { key: "balance_due", header: "Balance Due" },
    { key: "due_date",   header: "Due Date" },
    { key: "aging",      header: "Aging" },
    { key: "salesperson", header: "Salesperson" },
    { key: "status",     header: "Status" },
  ]);

  return csvResponse(csv, `collections-${todayStamp()}.csv`);
}
