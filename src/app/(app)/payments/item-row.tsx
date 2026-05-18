"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Trash2, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { markPaid, unmarkPaid, deleteItem, upsertItem } from "./actions";
import { fmtMoney, type ExpenseItem } from "./helpers";

const MONTHS = [
  ["1", "January"], ["2", "February"], ["3", "March"], ["4", "April"],
  ["5", "May"], ["6", "June"], ["7", "July"], ["8", "August"],
  ["9", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
];

export function ItemRow({
  item,
  paid,
  paidActual,
  paidOn,
  expected,
  monthCursor,
  categories,
}: {
  item: ExpenseItem;
  paid: boolean;
  paidActual: number;
  paidOn: string | null;
  expected: number;
  monthCursor: string;
  categories: string[];
}) {
  const [pending, start] = useTransition();
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [amount, setAmount] = useState(String(item.budget || ""));

  function togglePaid() {
    if (paid) {
      start(() => unmarkPaid(item.id, monthCursor));
    } else {
      setAmount(String(item.budget || ""));
      setShowPaidModal(true);
    }
  }

  function handleConfirm() {
    const v = Number(amount) || 0;
    start(async () => {
      await markPaid(item.id, monthCursor, v);
      setShowPaidModal(false);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${item.name}"? This removes it from all months.`)) return;
    start(() => deleteItem(item.id));
  }

  return (
    <li
      className={`group flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
        paid
          ? "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      }`}
    >
      <button
        type="button"
        disabled={pending}
        onClick={togglePaid}
        aria-label={paid ? "Mark unpaid" : "Mark paid"}
        title={paid ? "Click to mark unpaid" : "Click to mark paid"}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
          paid
            ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
            : "border-zinc-300 text-zinc-400 hover:scale-110 hover:border-emerald-400 dark:border-zinc-700"
        }`}
      >
        {paid && <Check className="h-3 w-3" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`truncate text-sm ${
            paid
              ? "text-zinc-500 line-through dark:text-zinc-500"
              : "font-medium text-zinc-900 dark:text-zinc-100"
          }`}
          title={item.name}
        >
          {item.name}
        </span>
        <span className="truncate text-xs text-zinc-500">
          {paid ? (
            <>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {fmtMoney(paidActual)}
              </span>
              {paidOn && (
                <>
                  {" · paid "}
                  {new Date(paidOn).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </>
              )}
            </>
          ) : expected > 0 ? (
            <>
              Budget: <span className="tabular-nums">{fmtMoney(expected)}</span> · due
              day {item.due_day}
            </>
          ) : (
            <>No budget set · due day {item.due_day}</>
          )}
        </span>
      </div>

      <Badge tone={item.frequency === "Monthly" ? "success" : item.frequency === "Annual" ? "warning" : "info"}>
        {item.frequency}
      </Badge>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
          aria-label="Item menu"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 z-20 w-32 overflow-hidden rounded-md border border-zinc-200 bg-white text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                setShowEditModal(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                handleDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Mark-paid modal */}
      {showPaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mb-1 text-base font-semibold">Mark &quot;{item.name}&quot; as paid</h3>
            <p className="mb-3 text-xs text-zinc-500">
              {item.budget > 0
                ? `Budget: ${fmtMoney(item.budget)} — edit if the actual amount differs.`
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
                if (e.key === "Escape") setShowPaidModal(false);
              }}
              placeholder="Actual amount paid"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaidModal(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={pending}>
                {pending ? "Saving…" : "Confirm paid"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditItemModal
          item={item}
          categories={categories}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </li>
  );
}

function EditItemModal({
  item,
  categories,
  onClose,
}: {
  item: ExpenseItem;
  categories: string[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-4 text-base font-semibold">Edit recurring item</h3>
        <form
          action={(fd) => {
            fd.set("id", item.id);
            start(async () => {
              const res = await upsertItem(undefined, fd);
              if (res?.error) setErr(res.error);
              else onClose();
            });
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Name *</Label>
            <Input name="name" defaultValue={item.name} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Category *</Label>
            <Select name="category" defaultValue={item.category} required>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Frequency</Label>
            <Select name="frequency" defaultValue={item.frequency}>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Annual</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Budget (₹)</Label>
            <Input name="budget" type="number" step="0.01" defaultValue={item.budget} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Due day</Label>
            <Input
              name="due_day"
              type="number"
              min="1"
              max="31"
              defaultValue={item.due_day}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Due month</Label>
            <Select name="due_month" defaultValue={item.due_month ?? ""}>
              <option value="">—</option>
              {MONTHS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Reminder days</Label>
            <Input
              name="reminder_days"
              type="number"
              min="0"
              defaultValue={item.reminder_days}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <Label>Notes</Label>
            <Textarea name="notes" defaultValue={item.notes ?? ""} />
          </div>
          {err && (
            <div className="text-sm text-red-600 sm:col-span-3">{err}</div>
          )}
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
