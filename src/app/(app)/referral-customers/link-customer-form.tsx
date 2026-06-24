"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { linkCustomer } from "./actions";

type Lead = { id: string; name: string; phone: string | null };
type Referrer = { id: string; name: string };

export function LinkCustomerForm({ teamId, leads, referrers }: { teamId: string; leads: Lead[]; referrers: Referrer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState("");
  const [selectedReferrer, setSelectedReferrer] = useState("");

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
    setSelectedLead("");
    setSelectedReferrer("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
        style={{ background: "#b5c76a", color: "#1a1a1a" }}>
        + Link Customer to Referrer
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-zinc-700 bg-[#1a1a1a] p-6 flex flex-col gap-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100">Link Customer to Referrer</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead_id">Customer *</Label>
            <select id="lead_id" name="lead_id" required value={selectedLead} onChange={(e) => setSelectedLead(e.target.value)}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none">
              <option value="">Select customer…</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referrer_id">Referrer *</Label>
            <select id="referrer_id" name="referrer_id" required value={selectedReferrer} onChange={(e) => setSelectedReferrer(e.target.value)}
              className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none">
              <option value="">Select referrer…</option>
              {referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-zinc-500">Commission rates are taken from the referrer's default settings automatically.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Link"}</Button>
        </div>
      </form>
    </div>
  );
}

export function QuickLinkButton({ teamId, leadId, referrerId, leadName, referrerName }: {
  teamId: string; leadId: string; referrerId: string; leadName: string; referrerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("team_id", teamId);
    fd.set("lead_id", leadId);
    fd.set("referrer_id", referrerId);
    const res = await linkCustomer(fd);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="rounded-md border border-[#b5c76a]/30 bg-[#b5c76a]/10 px-3 py-1 text-xs text-[#b5c76a] hover:bg-[#b5c76a]/20 transition-colors">
        Link →
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-[#1a1a1a] p-6 flex flex-col gap-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-zinc-100">Confirm Link</h2>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-zinc-500 w-20">Customer</span>
                <span className="text-sm font-medium text-zinc-100">{leadName}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-zinc-500 w-20">Referrer</span>
                <span className="text-sm font-semibold text-[#b5c76a]">{referrerName}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500">Commission rates will be inherited from {referrerName}'s default settings.</p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" onClick={confirm} disabled={saving}>{saving ? "Linking…" : "Confirm Link"}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
