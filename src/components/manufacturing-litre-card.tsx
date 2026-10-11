import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { MonthProduction } from "@/lib/production-month";
import { RATE_SOAP_PHENYL, RATE_OTHER, isSoapOrPhenyl } from "@/lib/manufacturing-cost";

export type LastProductionEntry = {
  date: string;
  amount: number;
  daysAgo: number;
  accounts: string[];
};

/**
 * What was manufactured this month, per product.
 *
 * Reads production records — expense lines booked to a production account,
 * plus anything entered in the app — rather than invoice lines. Invoices say
 * what was SOLD, which is the Sales Mix card's job; using them here made the
 * litres drift from what was actually made by whatever went into stock.
 */
export function ManufacturingLitreCard({
  production,
  currency,
  daysAgo,
}: {
  production: MonthProduction;
  currency: string;
  /** Days since the last production record of any kind, null if none. */
  daysAgo: number | null;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const litres = (v: number) =>
    `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v)} L`;

  const { items, totalLitres, totalCost, lastDate, unreadLines } = production;
  const stale = daysAgo !== null && daysAgo > 30;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-2xl font-bold tabular-nums text-zinc-100">{money(totalCost)}</div>
        <div className="text-xs text-zinc-500">
          {totalLitres > 0 ? `${litres(totalLitres)} produced this period` : "nothing recorded this period"}
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((it) => {
            const rate = isSoapOrPhenyl(it.product) ? RATE_SOAP_PHENYL : RATE_OTHER;
            return (
              <div key={it.product} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: rate === RATE_SOAP_PHENYL ? "#b5c76a" : "#7ca3d4" }}
                />
                <span className="truncate text-zinc-300">{it.product}</span>
                <span className="shrink-0 text-[11px] text-zinc-500">₹{rate}/L</span>
                <span className="ml-auto shrink-0 tabular-nums text-zinc-400">
                  {litres(it.litres)}
                </span>
                <span className="w-20 shrink-0 text-right tabular-nums text-zinc-200">
                  {money(it.amount)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          No production recorded for this month yet.{" "}
          <Link href="/production" className="text-zinc-300 underline hover:text-zinc-100">
            Record it
          </Link>
          .
        </p>
      )}

      {unreadLines > 0 && (
        // Quoting the amount here would read as money missing from the total,
        // which it usually is not: a bank-narration line is often the payment
        // for litres already named in a sibling line's text.
        <p className="text-[11px] text-amber-500">
          {unreadLines} production line{unreadLines === 1 ? " states" : "s state"} no litres
          in Zoho — check it is covered by the products above.
        </p>
      )}

      <div className="border-t border-zinc-800 pt-2 text-xs">
        {lastDate ? (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-zinc-500">Production last recorded</span>
            <span className="text-zinc-300">{format(parseISO(lastDate), "dd MMM yyyy")}</span>
            <span className={stale ? "text-amber-500" : "text-zinc-500"}>
              · {daysAgo === 0 ? "today" : `${daysAgo} days ago`}
            </span>
            <Link
              href="/production"
              className="ml-auto text-zinc-500 underline hover:text-zinc-300"
            >
              Open
            </Link>
          </div>
        ) : (
          <span className="text-amber-500">No production recorded yet</span>
        )}
      </div>
    </div>
  );
}
