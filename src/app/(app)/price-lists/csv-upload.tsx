"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertPriceList } from "./actions";

type Template = { id: string; name: string; sku: string | null; rate: number | null; unit: string | null };

type ParsedRow = {
  sku: string;
  custom_rate: number;
  note: string;
  item_id: string | null;
  item_name: string | null;
  std_rate: number | null;
};

export function CsvUpload({
  teamId,
  leadId,
  templates,
}: {
  teamId: string;
  leadId: string;
  templates: Template[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skuMap = new Map(templates.filter((t) => t.sku).map((t) => [t.sku!.toLowerCase(), t]));

  function parseCsv(text: string): ParsedRow[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const skuIdx = header.indexOf("sku");
    const rateIdx = header.indexOf("custom_rate");
    const noteIdx = header.indexOf("note");
    if (skuIdx === -1 || rateIdx === -1) throw new Error("CSV must have columns: sku, custom_rate");

    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const sku = cols[skuIdx] ?? "";
      const custom_rate = parseFloat(cols[rateIdx] ?? "0");
      const note = noteIdx >= 0 ? (cols[noteIdx] ?? "") : "";
      const match = skuMap.get(sku.toLowerCase()) ?? null;
      return {
        sku,
        custom_rate,
        note,
        item_id: match?.id ?? null,
        item_name: match?.name ?? null,
        std_rate: match?.rate != null ? Number(match.rate) : null,
      };
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCsv(ev.target?.result as string);
        setPreview(parsed);
      } catch (err) {
        setError(String(err));
      }
    };
    reader.readAsText(file);
  }

  async function confirm() {
    if (!preview) return;
    const matched = preview.filter((r) => r.item_id && !isNaN(r.custom_rate));
    if (matched.length === 0) { setError("No rows matched. Check SKUs."); return; }
    setSaving(true);
    const result = await upsertPriceList(
      teamId,
      leadId,
      matched.map((r) => ({ item_id: r.item_id!, custom_rate: r.custom_rate, note: r.note }))
    );
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const matched = preview?.filter((r) => r.item_id).length ?? 0;
  const unmatched = preview?.filter((r) => !r.item_id).length ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#b5c76a]/10 border border-[#b5c76a]/30 px-3 py-1.5 text-sm text-[#b5c76a] hover:bg-[#b5c76a]/20 transition-colors">
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        Upload CSV
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-2xl rounded-xl bg-[#1a1a1a] border border-zinc-700 p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-semibold">Preview CSV Import</h2>
            <p className="mb-4 text-sm text-zinc-400">
              <span className="text-[#b5c76a] font-medium">{matched} matched</span>
              {unmatched > 0 && <span className="ml-2 text-red-400">{unmatched} unmatched (will be skipped)</span>}
            </p>
            <div className="max-h-72 overflow-y-auto rounded border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Std Rate</th>
                    <th className="px-3 py-2 text-right">Custom Rate</th>
                    <th className="px-3 py-2 text-left">Note</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-800">
                      <td className="px-3 py-2 font-mono text-xs text-zinc-400">{r.sku}</td>
                      <td className="px-3 py-2 text-zinc-300">{r.item_name ?? <span className="text-zinc-600">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{r.std_rate != null ? r.std_rate.toFixed(2) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-100">{r.custom_rate.toFixed(2)}</td>
                      <td className="px-3 py-2 text-zinc-500 text-xs">{r.note || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {r.item_id
                          ? <span className="text-[#b5c76a] text-xs">✓</span>
                          : <span className="text-red-400 text-xs">✕</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-3 justify-end">
              <button onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">
                Cancel
              </button>
              <button onClick={confirm} disabled={saving || matched === 0}
                className="rounded-md bg-[#b5c76a] px-4 py-2 text-sm font-semibold text-[#1a1a1a] hover:bg-[#c9da7e] disabled:opacity-50">
                {saving ? "Saving…" : `Save ${matched} rows`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
