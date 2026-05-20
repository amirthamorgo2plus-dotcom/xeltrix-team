"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { MessageSquare, Trash2, AtSign } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { addTaskComment, deleteTaskComment } from "./comment-actions";

export type TaskComment = {
  id: string;
  body: string;
  author_id: string;
  mentioned_ids: string[];
  created_at: string;
};

type Member = { id: string; name: string; avatar_url: string | null };

export function TaskComments({
  taskId,
  comments,
  members,
  myMemberId,
  canManage,
}: {
  taskId: string;
  comments: TaskComment[];
  members: Member[];
  myMemberId: string | null;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const memberById = new Map(members.map((m) => [m.id, m]));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : "Add comment"}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {comments.length} comment{comments.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Hide
        </button>
      </div>

      {comments.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {comments.map((c) => {
            const author = memberById.get(c.author_id);
            const canDelete = canManage || c.author_id === myMemberId;
            return (
              <li
                key={c.id}
                className="flex items-start gap-2 rounded border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Avatar src={author?.avatar_url} name={author?.name} size={20} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{author?.name ?? "Unknown"}</span>
                    <span className="text-[10px] text-zinc-500">
                      {format(new Date(c.created_at), "dd MMM, HH:mm")}
                    </span>
                  </div>
                  <CommentBody body={c.body} mentionedIds={c.mentioned_ids} members={members} />
                </div>
                {canDelete && (
                  <DeleteButton id={c.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CommentForm taskId={taskId} members={members} />
    </div>
  );
}

function CommentBody({
  body,
  mentionedIds,
  members,
}: {
  body: string;
  mentionedIds: string[];
  members: Member[];
}) {
  // Highlight @Name tokens where the name matches a mentioned member.
  const mentionedNames = new Set(
    mentionedIds
      .map((id) => members.find((m) => m.id === id)?.name)
      .filter(Boolean) as string[]
  );

  const parts = body.split(/(@[A-Za-z0-9_]+(?:\s[A-Za-z0-9_]+)?)/g);
  return (
    <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const name = part.slice(1).trim();
          if (mentionedNames.has(name) || mentionedIds.length > 0) {
            return (
              <span
                key={i}
                className="rounded bg-emerald-500/15 px-1 font-medium text-emerald-700 dark:text-emerald-300"
              >
                {part}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this comment?")) {
          start(() => deleteTaskComment(id));
        }
      }}
      className="text-zinc-400 hover:text-red-600"
      aria-label="Delete comment"
      title="Delete"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function CommentForm({
  taskId,
  members,
}: {
  taskId: string;
  members: Member[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [mentioned, setMentioned] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState(addTaskComment, undefined);

  function toggleMention(member: Member) {
    setMentioned((prev) => {
      const next = new Set(prev);
      if (next.has(member.id)) {
        next.delete(member.id);
        // Also strip @Name from the text (best-effort)
        setText((t) => t.replace(new RegExp(`@${member.name}\\s?`, "g"), ""));
      } else {
        next.add(member.id);
        const insert = `@${member.name} `;
        setText((t) => (t.includes(insert) ? t : t + (t.endsWith(" ") || t.length === 0 ? "" : " ") + insert));
        setTimeout(() => textRef.current?.focus(), 0);
      }
      return next;
    });
  }

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        if (!state?.error) {
          ref.current?.reset();
          setMentioned(new Set());
          setText("");
        }
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="mentioned_ids" value={Array.from(mentioned).join(",")} />
      <textarea
        ref={textRef}
        name="body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message…"
        rows={2}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
          <AtSign className="h-3 w-3" /> Tag:
        </span>
        {members.map((m) => {
          const active = mentioned.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMention(m)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {active ? "✓ " : "+ "}
              {m.name}
            </button>
          );
        })}
        <Button size="sm" type="submit" disabled={pending || !text.trim()} className="ml-auto">
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
