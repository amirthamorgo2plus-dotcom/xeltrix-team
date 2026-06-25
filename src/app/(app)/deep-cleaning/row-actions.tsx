"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPaymentStatus, setReferralStatus, deleteJob } from "./actions";

export function PaymentToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const paid = status === "paid";
  return (
    <button
      disabled={busy}
      onClick={async () => { setBusy(true); await setPaymentStatus(id, paid ? "pending" : "paid"); setBusy(false); router.refresh(); }}
      className={`rounded-full px-2 py-0.5 text-xs transition-colors ${paid ? "bg-[#b5c76a]/10 text-[#b5c76a]" : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"}`}
    >
      {paid ? "✅ Paid" : "⬜ Pending"}
    </button>
  );
}

export function ReferralToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const paid = status === "paid";
  return (
    <button
      disabled={busy}
      onClick={async () => { setBusy(true); await setReferralStatus(id, paid ? "pending" : "paid"); setBusy(false); router.refresh(); }}
      className={`rounded-full px-2 py-0.5 text-xs transition-colors ${paid ? "bg-[#b5c76a]/10 text-[#b5c76a]" : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"}`}
    >
      {paid ? "✅ Paid" : "⬜ Pay"}
    </button>
  );
}

export function DeleteJob({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <button onClick={() => setConfirm(true)} className="text-xs text-zinc-600 hover:text-red-400">✕</button>;
  return (
    <button
      onClick={async () => { await deleteJob(id); router.refresh(); }}
      className="text-xs text-red-400 hover:text-red-300"
    >
      Confirm?
    </button>
  );
}
