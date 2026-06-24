"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCostPrice } from "./actions";

export function CostPriceCell({ id, cost, currency }: { id: string; cost: number | null; currency: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cost != null ? String(cost) : "");
  const [saving, setSaving] = useState(false);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(v);

  async function save() {
    setSaving(true);
    await saveCostPrice(id, value ? Number(value) : null);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
          className="w-24 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-right text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none tabular-nums"
        />
        <button onClick={save} disabled={saving} className="text-xs text-[#b5c76a] hover:underline">
          {saving ? "…" : "✓"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 hover:underline">✕</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex w-full items-center justify-end gap-1 tabular-nums hover:text-[#b5c76a] transition-colors"
      title="Click to edit cost price"
    >
      <span className="text-zinc-400">{cost != null ? fmt(cost) : <span className="text-zinc-600 text-xs">add cost</span>}</span>
      <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100">✏️</span>
    </button>
  );
}
