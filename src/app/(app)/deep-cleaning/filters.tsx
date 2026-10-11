"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open (enquiry + confirmed)" },
  { value: "enquiry", label: "Enquiry" },
  { value: "confirmed", label: "Confirmed" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "Any payment" },
  { value: "pending", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

export type FilterState = {
  status: string;
  payment: string;
  assigned: string;
  month: string;
};

export function JobFilters({
  members,
  months,
  current,
}: {
  members: { id: string; name: string }[];
  /** Months that actually have scheduled work, newest first. */
  months: string[];
  current: FilterState;
}) {
  const router = useRouter();

  function go(next: Partial<FilterState>) {
    const merged = { ...current, ...next };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `/deep-cleaning?${qs}` : "/deep-cleaning");
  }

  const active = Object.entries(current).filter(([, v]) => v && v !== "all").length;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Status</label>
        <Select
          value={current.status}
          onChange={(e) => go({ status: e.target.value })}
          className="h-9 w-56"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Payment</label>
        <Select
          value={current.payment}
          onChange={(e) => go({ payment: e.target.value })}
          className="h-9 w-36"
        >
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Done by</label>
        <Select
          value={current.assigned}
          onChange={(e) => go({ assigned: e.target.value })}
          className="h-9 w-44"
        >
          <option value="all">Anyone</option>
          <option value="none">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Service month</label>
        <Select
          value={current.month}
          onChange={(e) => go({ month: e.target.value })}
          className="h-9 w-40"
        >
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Date(`${m}-01T00:00:00Z`).toLocaleString("en-IN", {
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
            </option>
          ))}
        </Select>
      </div>

      {active > 0 && (
        <button
          onClick={() => router.push("/deep-cleaning")}
          className="h-9 rounded-md border border-zinc-300 px-3 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Clear {active} filter{active === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
