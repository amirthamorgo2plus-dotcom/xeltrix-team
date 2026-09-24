"use client";

import { useActionState, useState, useTransition } from "react";
import { format, differenceInDays } from "date-fns";
import { ist } from "@/lib/ist";
import { ChevronDown, ChevronRight, MessageSquare, Trash2, AtSign } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateComplaint, resolveComplaint } from "./actions";
import { addComplaintComment, deleteComplaintComment } from "./comment-actions";

export type Complaint = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  subject: string;
  description: string | null;
  severity: string;
  status: string;
  opened_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

export type ComplaintComment = {
  id: string;
  body: string;
  author_id: string;
  mentioned_ids: string[];
  created_at: string;
};

type Member = { id: string; name: string; avatar_url: string | null };

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "in_progress", "resolved", "closed"];

const sevTone: Record<string, "muted" | "info" | "warning" | "danger"> = {
  low: "muted",
  medium: "info",
  high: "warning",
  critical: "danger",
};

export function ComplaintRow({
  complaint: c,
  comments,
  members,
  myMemberId,
  canManage,
  columns,
}: {
  complaint: Complaint;
  comments: ComplaintComment[];
  members: Member[];
  myMemberId: string | null;
  canManage: boolean;
  columns: number;
}) {
  const [open, setOpen] = useState(false);
  const isClosed = c.status === "resolved" || c.status === "closed";
  const ageDays = differenceInDays(
    new Date(c.resolved_at ?? new Date()),
    new Date(c.opened_at)
  );

  return (
    <>
      <tr className="border-t border-zinc-200 dark:border-zinc-800">
        <td className="py-2 pr-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-left font-medium hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
            {c.customer_name}
          </button>
        </td>
        <td className="py-2 pr-4">
          {c.subject}
          {comments.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-zinc-500">
              <MessageSquare className="h-3 w-3" />
              {comments.length}
            </span>
          )}
        </td>
        <td className="py-2 pr-4">
          <Badge tone={sevTone[c.severity] ?? "muted"}>{c.severity}</Badge>
        </td>
        <td className="py-2 pr-4">
          <Badge tone={isClosed ? "success" : c.status === "in_progress" ? "info" : "warning"}>
            {c.status.replace("_", " ")}
          </Badge>
        </td>
        <td className="py-2 pr-4 text-zinc-500">{format(ist(c.opened_at), "dd MMM")}</td>
        <td className="py-2 text-zinc-500">
          {isClosed ? `${ageDays}d to resolve` : `${ageDays}d open`}
        </td>
      </tr>

      {open && (
        <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
          <td colSpan={columns} className="px-3 py-4">
            <div className="flex flex-col gap-5">
              <EditPanel complaint={c} canManage={canManage} />
              <StatusPanel complaint={c} />
              <CommentsPanel
                complaintId={c.id}
                comments={comments}
                members={members}
                myMemberId={myMemberId}
                canManage={canManage}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function EditPanel({ complaint: c, canManage }: { complaint: Complaint; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Details
          </h4>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {c.description || <span className="text-zinc-500">No description.</span>}
        </p>
        {c.customer_email && (
          <p className="text-xs text-zinc-500">{c.customer_email}</p>
        )}
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          const res = await updateComplaint(fd);
          if (res?.error) setError(res.error);
          else setEditing(false);
        });
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={c.id} />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Edit complaint
      </h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`cn-${c.id}`}>Customer name *</Label>
          <Input id={`cn-${c.id}`} name="customer_name" defaultValue={c.customer_name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`ce-${c.id}`}>Customer email</Label>
          <Input id={`ce-${c.id}`} name="customer_email" type="email" defaultValue={c.customer_email ?? ""} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`sub-${c.id}`}>Subject *</Label>
        <Input id={`sub-${c.id}`} name="subject" defaultValue={c.subject} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`sev-${c.id}`}>Severity</Label>
        <select
          id={`sev-${c.id}`}
          name="severity"
          defaultValue={c.severity}
          className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`desc-${c.id}`}>Description</Label>
        <Textarea id={`desc-${c.id}`} name="description" defaultValue={c.description ?? ""} rows={3} />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !canManage}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {!canManage && (
        <p className="text-xs text-zinc-500">Only an admin or manager can save edits.</p>
      )}
    </form>
  );
}

function StatusPanel({ complaint: c }: { complaint: Complaint }) {
  const [status, setStatus] = useState(c.status);
  const [note, setNote] = useState(c.resolution_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const closing = status === "resolved" || status === "closed";

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          const res = await resolveComplaint(fd);
          if (res?.error) setError(res.error);
        });
      }}
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
    >
      <input type="hidden" name="id" value={c.id} />
      <input type="hidden" name="status" value={status} />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Status &amp; resolution
      </h4>
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              status === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`note-${c.id}`}>
          What was done{closing && <span className="text-red-400"> *</span>}
        </Label>
        <Textarea
          id={`note-${c.id}`}
          name="resolution_note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. Replaced the batch and confirmed with the customer"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save status"}
        </Button>
        {c.resolved_at && (
          <span className="text-xs text-zinc-500">
            Resolved {format(ist(c.resolved_at), "dd MMM yyyy")}
          </span>
        )}
      </div>
    </form>
  );
}

function CommentsPanel({
  complaintId,
  comments,
  members,
  myMemberId,
  canManage,
}: {
  complaintId: string;
  comments: ComplaintComment[];
  members: Member[];
  myMemberId: string | null;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(addComplaintComment, undefined);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        History {comments.length > 0 && `(${comments.length})`}
      </h4>

      {comments.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Nothing recorded yet — add the first update below.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((cm) => {
            const author = memberById.get(cm.author_id);
            const mine = myMemberId === cm.author_id;
            return (
              <li key={cm.id} className="flex items-start gap-2">
                <Avatar src={author?.avatar_url ?? null} name={author?.name} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">{author?.name ?? "Someone"}</span>
                    <span className="text-zinc-500">
                      {format(ist(cm.created_at), "dd MMM, HH:mm")}
                    </span>
                    {(mine || canManage) && (
                      <button
                        type="button"
                        onClick={() => deleteComplaintComment(cm.id)}
                        className="text-zinc-500 hover:text-red-400"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                    {cm.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="complaint_id" value={complaintId} />
        <input type="hidden" name="mentioned_ids" value={mentions.join(",")} />
        <Textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add an update…"
        />
        {showMentions && (
          <div className="flex flex-wrap gap-1.5">
            {members.map((mem) => {
              const on = mentions.includes(mem.id);
              return (
                <button
                  key={mem.id}
                  type="button"
                  onClick={() =>
                    setMentions((prev) =>
                      on ? prev.filter((x) => x !== mem.id) : [...prev, mem.id]
                    )
                  }
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    on
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  @{mem.name}
                </button>
              );
            })}
          </div>
        )}
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={pending}>
            {pending ? "Posting…" : "Add update"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={() => setShowMentions((v) => !v)}
          >
            <AtSign className="h-3 w-3" /> Notify
          </Button>
        </div>
      </form>
    </div>
  );
}
