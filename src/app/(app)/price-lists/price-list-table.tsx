"use client";

import { useRouter } from "next/navigation";
import { deletePriceListRow } from "./actions";

type Row = { id: string; item_id: string; custom_rate: number; note: string | null };
type Template = { id: string; name: string; sku: string | null; rate: number | null; unit: string | null };

export function PriceListTable({
  rows,
  templates,
  teamId,
  leadId,
}: {
  rows: Row[];
  templates: Template[];
  teamId: string;
  leadId: string;
}) {
  const router = useRouter();
  const tMap = new Map(templates.map((t) => [t.id, t]));

  async function del(id: string) {
    await deletePriceListRow(id);
    router.refresh();
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="pb-2 pr-4">Item</th>
            <th className="pb-2 pr-4">SKU</th>
            <th className="pb-2 pr-4 text-right">Std Rate</th>
            <th className="pb-2 pr-4 text-right">Custom Rate</th>
            <th className="pb-2 pr-4 text-right">Discount</th>
            <th className="pb-2 pr-4">Note</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = tMap.get(r.item_id);
            const stdRate = t?.rate != null ? Number(t.rate) : null;
            const discount = stdRate && stdRate > 0 ? ((stdRate - r.custom_rate) / stdRate) * 100 : null;
            return (
              <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-800/20 transition-colors">
                <td className="py-2.5 pr-4 font-medium text-zinc-100">{t?.name ?? <span className="text-zinc-600">Unknown</span>}</td>
                <td className="py-2.5 pr-4 font-mono text-xs text-zinc-500">{t?.sku ?? "—"}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-500">{stdRate != null ? fmt(stdRate) : "—"}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-100 font-semibold">{fmt(r.custom_rate)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {discount != null ? (
                    <span className={`text-xs font-semibold ${discount > 0 ? "text-orange-400" : discount < 0 ? "text-[#b5c76a]" : "text-zinc-500"}`}>
                      {discount > 0 ? "-" : discount < 0 ? "+" : ""}{Math.abs(discount).toFixed(1)}%
                    </span>
                  ) : "—"}
                </td>
                <td className="py-2.5 pr-4 text-zinc-500 text-xs">{r.note ?? "—"}</td>
                <td className="py-2.5">
                  <button
                    onClick={() => del(r.id)}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
