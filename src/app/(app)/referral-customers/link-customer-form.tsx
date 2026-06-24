"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { linkCustomer } from "./actions";

type Lead = { id: string; name: string; phone: string | null };
type Referrer = { id: string; name: string };

type ModalState = { leadId: string; referrerId: string } | null;

function LinkModal({
  teamId, leads, referrers, preset, onClose,
}: {
  teamId: string;
  leads: Lead[];
  referrers: Referrer[];
  preset: ModalState;
  onClose: () => void;
}) {
  const router = useRouter();
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
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl border border-zinc-700 bg-[#1a1a1a] p-6 flex flex-col gap-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100">Link Customer to Referrer</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead_id">Customer *</Label>
            <select id="lead_id" name="lead_id" required defaultValue={preset?.leadId ?? ""} className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100">
              <option value="">Select customer…</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referrer_id">Referrer *</Label>
            <select id="referrer_id" name="referrer_id" required defaultValue={preset?.referrerId ?? ""} className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100">
              <option value="">Select referrer…</option>
              {referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="default_commission_pct">Default % *</Label>
            <Input id="default_commission_pct" name="default_commission_pct" type="number" min="0" max="100" step="0.5" defaultValue="5" required />
            <p className="text-[11px] text-zinc-600">All items</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="first_commission_pct">1st Invoice %</Label>
            <Input id="first_commission_pct" name="first_commission_pct" type="number" min="0" max="100" step="0.5" placeholder="e.g. 10" />
            <p className="text-[11px] text-zinc-600">First order only</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="traded_commission_pct">Traded % (R-)</Label>
            <Input id="traded_commission_pct" name="traded_commission_pct" type="number" min="0" max="100" step="0.5" placeholder="e.g. 5" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manufactured_commission_pct">Xeltrix % (X-)</Label>
            <Input id="manufactured_commission_pct" name="manufactured_commission_pct" type="number" min="0" max="100" step="0.5" placeholder="e.g. 10" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" placeholder="Any extra info…" />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </div>
  );
}

export function LinkCustomerForm({ teamId, leads, referrers }: { teamId: string; leads: Lead[]; referrers: Referrer[] }) {
  const [modal, setModal] = useState<ModalState>(null);
  return (
    <>
      <button
        onClick={() => setModal({ leadId: "", referrerId: "" })}
        className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
        style={{ background: "#b5c76a", color: "#1a1a1a" }}
      >
        + Link Customer to Referrer
      </button>
      {modal && (
        <LinkModal teamId={teamId} leads={leads} referrers={referrers} preset={modal} onClose={() => setModal(null)} />
      )}
    </>
  );
}

export function QuickLinkButton({
  teamId, leads, referrers, leadId, referrerId,
}: {
  teamId: string;
  leads: Lead[];
  referrers: Referrer[];
  leadId: string;
  referrerId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-[#b5c76a]/30 bg-[#b5c76a]/10 px-3 py-1 text-xs text-[#b5c76a] hover:bg-[#b5c76a]/20 transition-colors"
      >
        Link →
      </button>
      {open && (
        <LinkModal
          teamId={teamId}
          leads={leads}
          referrers={referrers}
          preset={{ leadId, referrerId }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
