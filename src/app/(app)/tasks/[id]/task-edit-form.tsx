"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateTask } from "../actions";

const PRIORITIES = ["low", "medium", "high", "urgent"];

/**
 * Edits the fields the inline list controls do not cover. Status and assignee
 * stay on their own controls, which save on change — this form is for the
 * fields where a half-typed value should not be written.
 */
export function TaskEditForm({
  id,
  title,
  description,
  dueAt,
  priority,
}: {
  id: string;
  title: string;
  description: string | null;
  /** ISO instant, or null. Rendered as a local datetime-local value. */
  dueAt: string | null;
  priority: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateTask, undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.saved) router.refresh();
  }, [state?.saved, router]);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Edit details
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-title">Title</Label>
        <Input id="task-title" name="title" defaultValue={title} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          name="description"
          defaultValue={description ?? ""}
          rows={4}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-due">Due</Label>
          <Input
            id="task-due"
            name="due_at"
            type="datetime-local"
            defaultValue={dueAt ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-priority">Priority</Label>
          <Select id="task-priority" name="priority" defaultValue={priority}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {state?.error && <span className="text-sm text-red-500">{state.error}</span>}
        {state?.saved && <span className="text-sm text-[#b5c76a]">Saved</span>}
      </div>
    </form>
  );
}
