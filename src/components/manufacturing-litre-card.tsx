import { format, parseISO } from "date-fns";
import type { ManufacturingLitreCost } from "@/lib/manufacturing-cost";
import { RATE_SOAP_PHENYL, RATE_OTHER } from "@/lib/manufacturing-cost";

export type LastProductionEntry = {
  date: string;
  amount: number;
  daysAgo: number;
  accounts: string[];
};

export function ManufacturingLitreCard({
  cost,
  currency,
}: {
  cost: ManufacturingLitreCost;
  currency: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const litres = (v: number) =>
    `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v)} L`;

  const rows = [
    { label: "Soap oil & phenyl", rate: RATE_SOAP_PHENYL, l: cost.soapLitres, amt: cost.soapCost, color: "#b5c76a" },
    { label: "Other liquids", rate: RATE_OTHER, l: cost.otherLitres, amt: cost.otherCost, color: "#7ca3d4" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-2xl font-bold tabular-nums text-zinc-100">{money(cost.totalCost)}</div>
        <div className="text-xs text-zinc-500">{litres(cost.totalLitres)} manufactured this period</div>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
            <span className="text-zinc-300">{r.label}</span>
            <span className="text-[11px] text-zinc-500">₹{r.rate}/L</span>
            <span className="ml-auto tabular-nums text-zinc-400">{litres(r.l)}</span>
            <span className="w-20 text-right tabular-nums text-zinc-200">{money(r.amt)}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

/**
 * When the real per-litre payment was last recorded.
 *
 * Rendered beside the card rather than inside it, because it matters most in
 * the case where the card has nothing to show: a month with no manufactured
 * litres and no payment booked is exactly when this has been forgotten.
 */
export function LastProductionEntryLine({
  lastEntry,
  currency,
}: {
  lastEntry: LastProductionEntry | null;
  currency: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  if (!lastEntry) {
    return (
      <p className="mt-3 border-t border-zinc-800 pt-2 text-xs text-amber-500">
        No production cost recorded yet
      </p>
    );
  }
  const stale = lastEntry.daysAgo > 30;
  return (
    <div className="mt-3 border-t border-zinc-800 pt-2 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-zinc-500">Production cost last entered</span>
        <span className="text-zinc-300">{format(parseISO(lastEntry.date), "dd MMM yyyy")}</span>
        <span className={stale ? "text-amber-500" : "text-zinc-500"}>
          · {lastEntry.daysAgo === 0 ? "today" : `${lastEntry.daysAgo} days ago`}
        </span>
        <span className="ml-auto tabular-nums text-zinc-400">{money(lastEntry.amount)}</span>
      </div>
      {stale && (
        <p className="mt-1 text-[11px] text-zinc-500">
          Nothing booked to {lastEntry.accounts.join(" or ")} since then.
        </p>
      )}
    </div>
  );
}
