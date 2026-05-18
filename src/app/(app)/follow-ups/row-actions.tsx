"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, RotateCcw, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { deleteFollowUp, reopenFollowUp, updateFollowUp } from "./actions";

export function RowActions({
  id,
  isDone,
  defaults,
}: {
  id: string;
  isDone: boolean;
  defaults: {
    due_at: string;
    channel: string | null;
    notes: string | null;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  function localDueValue(iso: string) {
    // Convert ISO to local datetime-local input format
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  if (editing) {
    return (
      <form
        action={(fd) =>
          start(async () => {
            await updateFollowUp(id, fd);
            setEditing(false);
          })
        }
        className="mt-2 grid grid-cols-1 gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-3"
      >
        <div className="flex flex-col gap-1">
          <Label>Due</Label>
          <Input
            name="due_at"
            type="datetime-local"
            defaultValue={localDueValue(defaults.due_at)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Channel</Label>
          <Input
            name="channel"
            defaultValue={defaults.channel ?? ""}
            placeholder="call / email / whatsapp"
            className="h-8 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-3">
          <Label>Notes</Label>
          <Textarea
            name="notes"
            defaultValue={defaults.notes ?? ""}
            className="min-h-[50px] text-xs"
          />
        </div>
        <div className="flex gap-2 sm:col-span-3">
          <Button size="sm" type="submit" disabled={pending}>
            <Save className="h-3 w-3" /> Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={pending}
            onClick={() => setEditing(false)}
          >
            <X className="h-3 w-3" /> Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {!isDone && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3 w-3" /> Edit
        </Button>
      )}
      {isDone && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => start(() => reopenFollowUp(id))}
        >
          <RotateCcw className="h-3 w-3" /> Reopen
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="text-red-600 hover:text-red-700"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this follow-up?")) {
            start(() => deleteFollowUp(id));
          }
        }}
      >
        <Trash2 className="h-3 w-3" /> Delete
      </Button>
    </div>
  );
}
