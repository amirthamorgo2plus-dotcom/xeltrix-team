"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPaymentStatus, setReferralStatus, deleteJob } from "./actions";

const pillClass = (paid: boolean, interactive: boolean) =>
  `rounded-full px-2 py-0.5 text-xs transition-colors ${
    paid
      ? "bg-[#b5c76a]/10 text-[#b5c76a]"
      : `bg-amber-500/10 text-amber-400${interactive ? " hover:bg-amber-500/20" : ""}`
  }`;

// Writes to deep_cleaning_jobs are admin/manager-only at the database level, so
// members get the status as a plain badge rather than a button that would be
// silently refused.
function StatusPill({ paid, label }: { paid: boolean; label: string }) {
  return <span className={pillClass(paid, false)}>{label}</span>;
}

function Failed({ message }: { message: string }) {
  return <p className="mt-1 text-[10px] leading-tight text-red-400">{message}</p>;
}

export function PaymentToggle({
  id,
  status,
  canManage,
}: {
  id: string;
  status: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = status === "paid";
  const label = paid ? "✅ Paid" : "⬜ Pending";

  if (!canManage) return <StatusPill paid={paid} label={label} />;

  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await setPaymentStatus(id, paid ? "pending" : "paid");
          setBusy(false);
          if (res.error) {
            setError(res.error);
            return;
          }
          router.refresh();
        }}
        className={pillClass(paid, true)}
      >
        {label}
      </button>
      {error && <Failed message={error} />}
    </div>
  );
}

export function ReferralToggle({
  id,
  status,
  canManage,
}: {
  id: string;
  status: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = status === "paid";
  const label = paid ? "✅ Paid" : "⬜ Pay";

  if (!canManage) return <StatusPill paid={paid} label={paid ? "✅ Paid" : "⬜ Pending"} />;

  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await setReferralStatus(id, paid ? "pending" : "paid");
          setBusy(false);
          if (res.error) {
            setError(res.error);
            return;
          }
          router.refresh();
        }}
        className={pillClass(paid, true)}
      >
        {label}
      </button>
      {error && <Failed message={error} />}
    </div>
  );
}

export function DeleteJob({ id, canManage }: { id: string; canManage: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  if (!confirm)
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-xs text-zinc-600 hover:text-red-400"
      >
        ✕
      </button>
    );

  return (
    <div>
      <button
        onClick={async () => {
          setError(null);
          const res = await deleteJob(id);
          if (res.error) {
            setError(res.error);
            setConfirm(false);
            return;
          }
          router.refresh();
        }}
        className="text-xs text-red-400 hover:text-red-300"
      >
        Confirm?
      </button>
      {error && <Failed message={error} />}
    </div>
  );
}
