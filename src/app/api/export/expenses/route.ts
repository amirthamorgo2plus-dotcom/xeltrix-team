import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse, todayStamp } from "@/lib/csv";
import { requireAdminOrManager } from "@/lib/export-helpers";

export async function GET() {
  // Expenses are admin/manager-only — members must not download them.
  const m = await requireAdminOrManager();
  if (!m) return new Response("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zoho_expenses")
    .select(
      "date, account_name, paid_through_account_name, vendor_name, customer_name, reference_number, description, amount, currency_code, location, status"
    )
    .order("date", { ascending: false });

  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(data ?? [], [
    { key: "date", header: "Date" },
    { key: "account_name", header: "Account" },
    { key: "paid_through_account_name", header: "Paid through" },
    { key: "vendor_name", header: "Vendor" },
    { key: "customer_name", header: "Customer" },
    { key: "reference_number", header: "Reference" },
    { key: "description", header: "Description" },
    { key: "amount", header: "Amount" },
    { key: "currency_code", header: "Currency" },
    { key: "location", header: "Location" },
    { key: "status", header: "Status" },
  ]);

  return csvResponse(csv, `expenses-${todayStamp()}.csv`);
}
