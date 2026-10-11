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
  status: string;
  service_date: string | null;
  service_time: string | null;
  enquiry_date: string | null;
  source: string | null;
  property_type: string | null;
  crew_size: number | null;
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
  defaultStatus,
  defaultServiceDate,
  label,
}: {
  teamId: string;
  referrers: Referrer[];
  members: Member[];
  edit?: JobEdit;
  trigger?: "button" | "edit";
  /** Opened from the schedule, where a new job is a booking, not an enquiry. */
  defaultStatus?: string;
  /** Pre-fills the day when added from a specific date on the calendar. */
  defaultServiceDate?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referrerId, setReferrerId] = useState(edit?.referrer_id ?? "");
  // Money and referral only matter once the work exists. An enquiry is a
  // name and a phone number, and a form that demands more than that is a
  // form nobody fills in — which is how this ended up in a spreadsheet.
  const [status, setStatus] = useState(edit?.status ?? defaultStatus ?? "enquiry");
  const isEnquiry = status === "enquiry" || status === "cancelled";
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
          {label ?? "+ Add Job"}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <form onSubmit={handleSubmit} className="my-8 w-full max-w-lg rounded-xl border border-zinc-700 bg-[#1a1a1a] p-6 flex flex-col gap-4 shadow-2xl">
            <h2 className="text-lg font-semibold text-zinc-100">{edit ? "Edit" : "Add"} Deep Cleaning Job</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-10 rounded-md border border-zinc-700 bg-transparent px-3 text-sm"
                >
                  <option value="enquiry">Enquiry (pending)</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enquiry_date">Enquiry date</Label>
                <Input
                  id="enquiry_date"
                  name="enquiry_date"
                  type="date"
                  defaultValue={edit?.enquiry_date ?? new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="customer_name">Customer *</Label>
                <Input id="customer_name" name="customer_name" required defaultValue={edit?.customer_name} placeholder="Customer / site name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={edit?.phone ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="service_date">
                  Service date {isEnquiry ? "" : "*"}
                </Label>
                <Input
                  id="service_date"
                  name="service_date"
                  type="date"
                  defaultValue={edit?.service_date ?? defaultServiceDate ?? ""}
                />
                {isEnquiry && (
                  <span className="text-[11px] text-zinc-500">
                    Leave blank until they confirm a day.
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="service_time">Start time</Label>
                <Input
                  id="service_time"
                  name="service_time"
                  type="time"
                  defaultValue={edit?.service_time?.slice(0, 5) ?? ""}
                />
                <span className="text-[11px] text-zinc-500">
                  Leave blank for a full day.
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="property_type">Property</Label>
                <select
                  id="property_type"
                  name="property_type"
                  defaultValue={edit?.property_type ?? "house"}
                  className="h-10 rounded-md border border-zinc-700 bg-transparent px-3 text-sm"
                >
                  <option value="house">House</option>
                  <option value="office">Office</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="source">Enquiry source</Label>
                <Input
                  id="source"
                  name="source"
                  defaultValue={edit?.source ?? ""}
                  placeholder="newspaper / office / referral"
                  list="dc-sources"
                />
                <datalist id="dc-sources">
                  <option value="newspaper" />
                  <option value="office" />
                  <option value="referral" />
                  <option value="walk-in" />
                </datalist>
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
                <Label htmlFor="crew_size">People on the job</Label>
                <Input
                  id="crew_size"
                  name="crew_size"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue={edit?.crew_size ?? ""}
                  placeholder="e.g. 3"
                />
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
