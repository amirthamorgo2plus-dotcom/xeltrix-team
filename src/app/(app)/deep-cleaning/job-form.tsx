"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveJob } from "./actions";

type Referrer = { id: string; name: string; default_pct: number | null };
type Member = { id: string; name: string };
export type JobEdit = {
  id: string;
  customer_name: string;
  phone: string | null;
  address: string | null;
  service_date: string;
  description: string | null;
  amount: number;
  cost: number | null;
  payment_status: string;
  payment_mode: string | null;
  referrer_id: string | null;
  referral_pct: number | null;
  assigned_to: string | null;
  notes: string | null;
};

export function JobForm({
  teamId,
  referrers,
  members,
  edit,
  trigger,
}: {
  teamId: string;
  referrers: Referrer[];
  members: Member[];
  edit?: JobEdit;
  trigger?: "button" | "edit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState(edit?.referrer_id ?? "");
  const [refPct, setRefPct] = useState(edit?.referral_pct != null ? String(edit.referral_pct) : "");

  const referrer = referrers.find((r) => r.id === referrerId) ?? null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("team_id", teamId);
    if (edit) fd.set("id", edit.id);
    const res = await saveJob(fd);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {trigger === "edit" ? (
        <button onClick={() => setOpen(true)} className="text-xs text-zinc-500 hover:text-[#b5c76a]">Edit</button>
      ) : (
        <button onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
          style={{ background: "#b5c76a", color: "#1a1a1a" }}>
          + Add Job
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <form onSubmit={handleSubmit} className="my-8 w-full max-w-lg rounded-xl border border-zinc-700 bg-[#1a1a1a] p-6 flex flex-col gap-4 shadow-2xl">
            <h2 className="text-lg font-semibold text-zinc-100">{edit ? "Edit" : "Add"} Deep Cleaning Job</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="customer_name">Customer *</Label>
                <Input id="customer_name" name="customer_name" required defaultValue={edit?.customer_name} placeholder="Customer / site name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={edit?.phone ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="service_date">Service date</Label>
                <Input id="service_date" name="service_date" type="date" defaultValue={edit?.service_date ?? new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={edit?.address ?? ""} />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="description">Work description</Label>
                <Input id="description" name="description" defaultValue={edit?.description ?? ""} placeholder="e.g. 2 BHK deep clean + sofa shampoo" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amount">Amount ₹ (no GST) *</Label>
                <Input id="amount" name="amount" type="number" min="0" step="0.01" required defaultValue={edit?.amount ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cost">Cost ₹ (materials+labour)</Label>
                <Input id="cost" name="cost" type="number" min="0" step="0.01" defaultValue={edit?.cost ?? ""} placeholder="optional" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payment_status">Payment</Label>
                <select id="payment_status" name="payment_status" defaultValue={edit?.payment_status ?? "pending"}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payment_mode">Mode</Label>
                <select id="payment_mode" name="payment_mode" defaultValue={edit?.payment_mode ?? ""}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none">
                  <option value="">—</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="referrer_id">Referrer (optional)</Label>
                <select id="referrer_id" name="referrer_id" value={referrerId}
                  onChange={(e) => {
                    setReferrerId(e.target.value);
                    const r = referrers.find((x) => x.id === e.target.value);
                    if (e.target.value && r?.default_pct != null && refPct === "") setRefPct(String(r.default_pct));
                  }}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none">
                  <option value="">— None —</option>
                  {referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="referral_pct">Referral %</Label>
                <Input id="referral_pct" name="referral_pct" type="number" min="0" step="0.1"
                  value={refPct} onChange={(e) => setRefPct(e.target.value)}
                  placeholder={referrer?.default_pct != null ? String(referrer.default_pct) : "—"}
                  disabled={!referrerId} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assigned_to">Done by</Label>
                <select id="assigned_to" name="assigned_to" defaultValue={edit?.assigned_to ?? ""}
                  className="h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 focus:border-[#b5c76a] focus:outline-none">
                  <option value="">—</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" defaultValue={edit?.notes ?? ""} />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Job"}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
