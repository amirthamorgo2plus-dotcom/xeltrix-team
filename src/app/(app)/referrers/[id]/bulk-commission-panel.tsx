"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logAllCommissions } from "./actions";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

// Logging commissions one invoice at a time meant the Mark All Paid panel never
// appeared, so nothing ever got paid. This commits every eligible invoice at the
// rates already shown in the table — and can settle them in the same click.
export function BulkCommissionPanel({
  referrerId,
  eligibleCount,
  estimatedTotal,
}: {
  referrerId: string;
  eligibleCount: number;
  estimatedTotal: number;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(markPaid: boolean) {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await logAllCommissions(referrerId, { markPaid, note });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setDone(
        res.paid
          ? `Logged and paid ${res.logged} commissions — ${fmt(res.total)}.`
          : `Logged ${res.logged} commissions — ${fmt(res.total)} now pending.`
      );
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#b5c76a]/25 bg-[#b5c76a]/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#b5c76a]">
            {eligibleCount} invoice{eligibleCount !== 1 ? "s" : ""} not yet logged —{" "}
            {fmt(estimatedTotal)} estimated commission
          </p>
          <p className="text-xs text-zinc-500">
            Uses the rates shown below: 1st invoice per customer at the bonus rate, the
            rest at the default.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`note-${referrerId}`}>
          Payment note <span className="text-zinc-500">(UPI ref, cheque no. — optional)</span>
        </Label>
        <Input
          id={`note-${referrerId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. UPI ref 123456"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {done && <p className="text-sm text-[#b5c76a]">{done}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => run(true)}
          style={{ background: "#b5c76a", color: "#1a1a1a" }}
        >
          {pending ? "Working…" : `Log & mark paid — ${fmt(estimatedTotal)}`}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run(false)}>
          Log only (pay later)
        </Button>
      </div>
    </div>
  );
}
