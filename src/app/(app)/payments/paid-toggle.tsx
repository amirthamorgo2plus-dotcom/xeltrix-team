"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { markPaid, unmarkPaid } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PaidToggle({
  itemId,
  itemName,
  defaultBudget,
  monthIso,
  paid,
}: {
  itemId: string;
  itemName: string;
  defaultBudget: number;
  monthIso: string;
  paid: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState(String(defaultBudget || ""));
  const [pending, start] = useTransition();

  function handleClick() {
    if (paid) {
      start(() => unmarkPaid(itemId, monthIso));
      return;
    }
    setShowModal(true);
  }

  function handleConfirm() {
    const v = Number(amount) || 0;
    start(async () => {
      await markPaid(itemId, monthIso, v);
      setShowModal(false);
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        aria-label={paid ? "Mark unpaid" : "Mark paid"}
        title={paid ? "Click to mark unpaid" : "Click to mark paid"}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          paid
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-300 text-zinc-400 hover:border-zinc-500 dark:border-zinc-700"
        }`}
      >
        {paid && <Check className="h-3 w-3" />}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mb-2 text-base font-semibold">Mark &quot;{itemName}&quot; as paid</h3>
            <p className="mb-3 text-xs text-zinc-500">
              {defaultBudget > 0
                ? `Budget: ₹${defaultBudget} — edit if the actual amount differs.`
                : "Enter the actual amount paid."}
            </p>
            <Input
              autoFocus
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
                if (e.key === "Escape") setShowModal(false);
              }}
              placeholder="Actual amount paid"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={pending}>
                {pending ? "Saving…" : "Confirm paid"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
