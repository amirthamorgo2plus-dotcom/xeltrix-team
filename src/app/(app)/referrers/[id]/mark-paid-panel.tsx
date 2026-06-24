"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markCommissionsPaid } from "../actions";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

export function MarkPaidPanel({ pendingIds, pendingTotal }: { pendingIds: string[]; pendingTotal: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setSaving(true);
    setError(null);
    const res = await markCommissionsPaid(pendingIds, note);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-amber-300">
            {pendingIds.length} invoice{pendingIds.length !== 1 ? "s" : ""} pending — {fmt(pendingTotal)} due
          </p>
          <p className="text-xs text-zinc-500">Mark all pending commissions as paid at once</p>
        </div>
        {!open && (
          <Button onClick={() => setOpen(true)} style={{ background: "#b5c76a", color: "#1a1a1a" }}>
            Mark All Paid
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay_note">Payment note <span className="text-zinc-500">(UPI ref, cheque no., etc.)</span></Label>
            <Input id="pay_note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. UPI ref 123456" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handlePay} disabled={saving} style={{ background: "#b5c76a", color: "#1a1a1a" }}>
              {saving ? "Saving…" : `Confirm — Pay ${fmt(pendingTotal)}`}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
