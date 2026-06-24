"use client";

type Row = {
  name: string;
  current: number;
  "1-15": number;
  "16-30": number;
  "31-45": number;
  "45+": number;
  total: number;
};

const BUCKETS: { key: keyof Omit<Row, "name" | "total">; label: string; color: string; muted: string }[] = [
  { key: "current", label: "Current",    color: "#b5c76a", muted: "rgba(181,199,106,0.12)" },
  { key: "1-15",    label: "1–15 days",  color: "#eab308", muted: "rgba(234,179,8,0.10)"   },
  { key: "16-30",   label: "16–30 days", color: "#f97316", muted: "rgba(249,115,22,0.10)"  },
  { key: "31-45",   label: "31–45 days", color: "#ef4444", muted: "rgba(239,68,68,0.10)"   },
  { key: "45+",     label: ">45 days",   color: "#f87171", muted: "rgba(248,113,113,0.10)" },
];

export function CollectionsChart({ data, currency }: { data: Row[]; currency: string }) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v);

  const grandTotal = data.reduce((s, r) => s + r.total, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="py-2.5 pr-4 text-left text-xs font-medium text-zinc-500 w-36">Salesperson</th>
            {BUCKETS.map((b) => (
              <th key={b.key} className="px-3 py-2.5 text-right text-xs font-medium" style={{ color: b.color }}>
                {b.label}
              </th>
            ))}
            <th className="pl-4 py-2.5 text-right text-xs font-medium text-zinc-400">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {data.map((row) => (
            <tr key={row.name} className="hover:bg-zinc-800/30 transition-colors">
              <td className="py-3 pr-4 font-medium text-zinc-200 text-xs leading-tight">{row.name}</td>
              {BUCKETS.map((b) => {
                const val = row[b.key];
                return (
                  <td key={b.key} className="px-3 py-3 text-right tabular-nums">
                    {val > 0 ? (
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                        style={{ color: b.color, background: b.muted }}
                      >
                        {fmt(val)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </td>
                );
              })}
              <td className="pl-4 py-3 text-right tabular-nums text-sm font-semibold text-zinc-100">
                {fmt(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
        {data.length > 1 && (
          <tfoot>
            <tr className="border-t border-zinc-700">
              <td className="py-3 pr-4 text-xs font-semibold text-zinc-400">Total</td>
              {BUCKETS.map((b) => {
                const bucketTotal = data.reduce((s, r) => s + r[b.key], 0);
                return (
                  <td key={b.key} className="px-3 py-3 text-right tabular-nums">
                    {bucketTotal > 0 ? (
                      <span className="text-xs font-semibold" style={{ color: b.color }}>
                        {fmt(bucketTotal)}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </td>
                );
              })}
              <td className="pl-4 py-3 text-right tabular-nums text-sm font-bold text-zinc-50">
                {fmt(grandTotal)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
