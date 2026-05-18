"use client";

import { useState, useTransition } from "react";
import { Check, X, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteSubmission,
  rejectSubmission,
  reopenSubmission,
  verifySubmission,
} from "./actions";

export type Submission = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  status: "pending" | "verified" | "rejected";
  notes: string | null;
  reject_reason: string | null;
  zoho_expense_id: string | null;
  memberName: string;
  isMine: boolean;
};

export type ZohoMatch = {
  id: string;
  date: string | null;
  amount: number;
  account: string | null;
  vendor: string | null;
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

export function SubmissionRow({
  s,
  canManage,
  candidateMatches,
}: {
  s: Submission;
  canManage: boolean;
  candidateMatches: ZohoMatch[];
}) {
  const [pending, start] = useTransition();
  const [selectedMatch, setSelectedMatch] = useState<string>(
    candidateMatches[0]?.id ?? ""
  );
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  return (
    <li className="flex flex-col gap-2 border-t border-zinc-200 py-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{s.description}</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {new Date(s.date).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}{" "}
            · {s.memberName}
            {s.category ? ` · ${s.category}` : ""}
          </div>
          {s.notes && (
            <div className="mt-1 text-xs text-zinc-500 italic">{s.notes}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-base font-semibold tabular-nums">{fmtMoney(s.amount)}</div>
          {s.status === "pending" && <Badge tone="warning">pending</Badge>}
          {s.status === "verified" && <Badge tone="success">verified</Badge>}
          {s.status === "rejected" && <Badge tone="danger">rejected</Badge>}
        </div>
      </div>

      {s.status === "rejected" && s.reject_reason && (
        <div className="text-xs text-red-600 dark:text-red-400">
          Rejected: {s.reject_reason}
        </div>
      )}

      {s.status === "pending" && canManage && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900/40">
          <span className="text-zinc-500">Match to Zoho:</span>
          <select
            value={selectedMatch}
            disabled={pending}
            onChange={(e) => setSelectedMatch(e.target.value)}
            suppressHydrationWarning
            className="h-7 rounded-md border border-zinc-300 bg-transparent px-2 text-xs dark:border-zinc-700"
          >
            <option value="">— no match (verify anyway) —</option>
            {candidateMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.date ?? "?"} · {fmtMoney(m.amount)} · {m.account ?? ""}
                {m.vendor ? ` (${m.vendor})` : ""}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(() => verifySubmission(s.id, selectedMatch || null))
            }
          >
            <Check className="h-3 w-3" /> Verify
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setShowReject((v) => !v)}
          >
            <X className="h-3 w-3" /> Reject…
          </Button>
          {showReject && (
            <>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason (optional)"
                className="h-7 w-48 text-xs"
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await rejectSubmission(s.id, rejectReason);
                    setShowReject(false);
                    setRejectReason("");
                  })
                }
              >
                Confirm reject
              </Button>
            </>
          )}
        </div>
      )}

      {s.status !== "pending" && canManage && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => start(() => reopenSubmission(s.id))}
          >
            <RotateCcw className="h-3 w-3" /> Reopen
          </Button>
        </div>
      )}

      {s.status === "pending" && s.isMine && !canManage && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (confirm("Delete this submission?")) {
                start(() => deleteSubmission(s.id));
              }
            }}
          >
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      )}
    </li>
  );
}
