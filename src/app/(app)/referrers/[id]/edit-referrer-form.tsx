"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateReferrer } from "./actions";

type Referrer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  bank_details: string;
  default_pct: number | null;
  traded_pct: number | null;
  manufactured_pct: number | null;
  first_invoice_pct: number | null;
};

export function EditReferrerForm({ referrer }: { referrer: Referrer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", referrer.id);
    const res = await updateReferrer(fd);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-700 px-3 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
      >
        ✏️ Edit
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl border border-zinc-700 bg-[#1a1a1a] p-6 flex flex-col gap-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100">Edit Referrer</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-name">Name *</Label>
            <Input id="e-name" name="name" required defaultValue={referrer.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-phone">Phone</Label>
            <Input id="e-phone" name="phone" defaultValue={referrer.phone} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-email">Email</Label>
            <Input id="e-email" name="email" type="email" defaultValue={referrer.email} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-bank">Bank Details</Label>
            <Input id="e-bank" name="bank_details" defaultValue={referrer.bank_details} placeholder="UPI / Account / IFSC" />
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Commission Rates</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-default">Default %</Label>
              <Input id="e-default" name="default_pct" type="number" min="0" max="100" step="0.1"
                defaultValue={referrer.default_pct ?? ""} placeholder="e.g. 5" />
              <p className="text-[11px] text-zinc-600">All items</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-traded">Traded %</Label>
              <Input id="e-traded" name="traded_pct" type="number" min="0" max="100" step="0.1"
                defaultValue={referrer.traded_pct ?? ""} placeholder="e.g. 3" />
              <p className="text-[11px] text-zinc-600">R- items</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-mfg">Manufactured %</Label>
              <Input id="e-mfg" name="manufactured_pct" type="number" min="0" max="100" step="0.1"
                defaultValue={referrer.manufactured_pct ?? ""} placeholder="e.g. 8" />
              <p className="text-[11px] text-zinc-600">X- / PM- / RM-</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-first">1st Invoice %</Label>
              <Input id="e-first" name="first_invoice_pct" type="number" min="0" max="100" step="0.1"
                defaultValue={referrer.first_invoice_pct ?? ""} placeholder="e.g. 10" />
              <p className="text-[11px] text-zinc-600">First order only</p>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        </div>
      </form>
    </div>
  );
}
