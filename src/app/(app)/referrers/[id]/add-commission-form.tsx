"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addCommission } from "./actions";

type Invoice = { id: string; title: string; value: number; leadName: string; closeDate: string | null };
type LinkInfo = { default_commission_pct: number; first_commission_pct: number | null; traded_commission_pct: number | null; manufactured_commission_pct: number | null; first_invoice_used: boolean };

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export function AddCommissionForm({
  teamId, referrerId, invoices, linkMap, leadIds, invoiceLeadMap,
}: {
  teamId: string;
  referrerId: string;
  invoices: Invoice[];
  linkMap: Record<string, LinkInfo>;
  leadIds: Record<string, string>;
  invoiceLeadMap: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInv, setSelectedInv] = useState<string>("");
  const [category, setCategory] = useState<string>("default");
  const [customPct, setCustomPct] = useState<string>("");

  function getSuggestedPct(invId: string, cat: string): number {
    const leadId = invoiceLeadMap[invId];
    const link = linkMap[leadId];
    if (!link) return 5;
    if (cat === "traded" && link.traded_commission_pct != null) return link.traded_commission_pct;
    if (cat === "manufactured" && link.manufactured_commission_pct != null) return link.manufactured_commission_pct;
    if (!link.first_invoice_used && link.first_commission_pct != null) return link.first_commission_pct;
    return link.default_commission_pct;
  }

  function getReason(invId: string, cat: string): string {
    const leadId = invoiceLeadMap[invId];
    const link = linkMap[leadId];
    if (!link) return "default";
    if (customPct) return "manual_override";
    if (cat === "traded" && link.traded_commission_pct != null) return "traded_rate";
    if (cat === "manufactured" && link.manufactured_commission_pct != null) return "manufactured_rate";
    if (!link.first_invoice_used && link.first_commission_pct != null) return "first_invoice";
    return "default";
  }

  const suggestedPct = selectedInv ? getSuggestedPct(selectedInv, category) : null;
  const finalPct = customPct ? Number(customPct) : (suggestedPct ?? 5);
  const selectedInvObj = invoices.find((i) => i.id === selectedInv);
  const commissionAmt = selectedInvObj ? (selectedInvObj.value * finalPct) / 100 : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("team_id", teamId);
    fd.set("referrer_id", referrerId);
    fd.set("commission_pct", String(finalPct));
    fd.set("commission_amount", String(commissionAmt));
    fd.set("rate_reason", customPct ? "manual_override" : getReason(selectedInv, category));
    fd.set("lead_id", invoiceLeadMap[selectedInv] ?? "");
    const res = await addCommission(fd);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    setSelectedInv("");
    setCustomPct("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-700 px-4 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        + Add Commission for Invoice
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-zinc-100">Add Commission Record</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Invoice *</Label>
          <select name="opportunity_id" required value={selectedInv} onChange={(e) => setSelectedInv(e.target.value)}
            className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100">
            <option value="">Select invoice…</option>
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.leadName} · {inv.title?.split("·")[0]?.trim()} · {fmt(inv.value)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Item Category</Label>
          <select name="invoice_category" value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100">
            <option value="default">Default (mixed)</option>
            <option value="traded">Traded items (R-)</option>
            <option value="manufactured">Xeltrix products (X-)</option>
          </select>
        </div>

        {selectedInv && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Commission %</Label>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
                  Suggested: {suggestedPct}%
                </span>
                <Input
                  placeholder="Override %"
                  type="number" min="0" max="100" step="0.5"
                  value={customPct}
                  onChange={(e) => setCustomPct(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Commission Amount</Label>
              <p className="text-xl font-bold" style={{ color: "#b5c76a" }}>{fmt(commissionAmt)}</p>
              <p className="text-xs text-zinc-500">{finalPct}% of {fmt(selectedInvObj?.value ?? 0)}</p>
            </div>
          </>
        )}

        {customPct && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Reason for override</Label>
            <Input name="override_note" placeholder="Why is this % different?" />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !selectedInv}>{saving ? "Saving…" : "Add Commission"}</Button>
        <Button type="button" variant="outline" onClick={() => { setOpen(false); setSelectedInv(""); setCustomPct(""); }}>Cancel</Button>
      </div>
    </form>
  );
}
