"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveReferrer } from "./actions";

export function ReferrerForm({ teamId }: { teamId: string }) {
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
    const res = await saveReferrer(fd);
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
        + Add Referrer
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-4">
      <h2 className="font-semibold text-zinc-100">New Referrer</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" required placeholder="Full name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" placeholder="Mobile number" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="email@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank_details">Bank Details</Label>
          <Input id="bank_details" name="bank_details" placeholder="UPI / Account / IFSC" />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium text-zinc-400 uppercase tracking-wide">Default Commission Rates</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="default_pct">Default %</Label>
            <Input id="default_pct" name="default_pct" type="number" min="0" max="100" step="0.1" placeholder="e.g. 5" />
            <p className="text-[11px] text-zinc-600">All items</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="traded_pct">Traded %</Label>
            <Input id="traded_pct" name="traded_pct" type="number" min="0" max="100" step="0.1" placeholder="e.g. 3" />
            <p className="text-[11px] text-zinc-600">R- items</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manufactured_pct">Manufactured %</Label>
            <Input id="manufactured_pct" name="manufactured_pct" type="number" min="0" max="100" step="0.1" placeholder="e.g. 8" />
            <p className="text-[11px] text-zinc-600">X- / PM- / RM-</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="first_invoice_pct">1st Invoice %</Label>
            <Input id="first_invoice_pct" name="first_invoice_pct" type="number" min="0" max="100" step="0.1" placeholder="e.g. 10" />
            <p className="text-[11px] text-zinc-600">First order only</p>
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Referrer"}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
