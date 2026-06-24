"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { linkCustomer } from "./actions";

type Lead = { id: string; name: string; phone: string | null };
type Referrer = { id: string; name: string };

export function LinkCustomerForm({ teamId, leads, referrers }: { teamId: string; leads: Lead[]; referrers: Referrer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("team_id", teamId);
    const res = await linkCustomer(fd);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
        style={{ background: "#b5c76a", color: "#1a1a1a" }}
      >
        + Link Customer to Referrer
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-zinc-100">Link Customer to Referrer</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lead_id">Customer *</Label>
          <select id="lead_id" name="lead_id" required className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100">
            <option value="">Select customer…</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="referrer_id">Referrer *</Label>
          <select id="referrer_id" name="referrer_id" required className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100">
            <option value="">Select referrer…</option>
            {referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="default_commission_pct">Default Commission % *</Label>
          <Input id="default_commission_pct" name="default_commission_pct" type="number" min="0" max="100" step="0.5" defaultValue="5" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="first_commission_pct">1st Invoice % <span className="text-zinc-500">(optional)</span></Label>
          <Input id="first_commission_pct" name="first_commission_pct" type="number" min="0" max="100" step="0.5" placeholder="e.g. 10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="traded_commission_pct">Traded items % <span className="text-zinc-500">(R- prefix)</span></Label>
          <Input id="traded_commission_pct" name="traded_commission_pct" type="number" min="0" max="100" step="0.5" placeholder="e.g. 5" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manufactured_commission_pct">Xeltrix products % <span className="text-zinc-500">(X- prefix)</span></Label>
          <Input id="manufactured_commission_pct" name="manufactured_commission_pct" type="number" min="0" max="100" step="0.5" placeholder="e.g. 10" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" placeholder="Any extra info about this referral…" />
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
