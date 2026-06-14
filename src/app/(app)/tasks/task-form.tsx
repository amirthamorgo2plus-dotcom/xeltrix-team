"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createTask } from "./actions";

export function TaskForm({
  members,
  myMemberId,
}: {
  members: { id: string; name: string }[];
  myMemberId: string | null;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await createTask(undefined, fd);
      if (res?.error) {
        setError(res.error);
      } else {
        setError(null);
        ref.current?.reset();
        setOpen(false); // back to the clean view on success
      }
    });
  }

  if (!open) {
    return (
      <div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Add task</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={submit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Title *</Label>
            <Input name="title" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Assign to</Label>
            <Select name="owner_id" defaultValue={myMemberId ?? ""}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === myMemberId ? `${m.name} (me)` : m.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Priority</Label>
            <Select name="priority" defaultValue="medium">
              <option>low</option>
              <option>medium</option>
              <option>high</option>
              <option>urgent</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Due (date & time)</Label>
            <Input name="due_at" type="datetime-local" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <Label>Description</Label>
            <Textarea name="description" />
          </div>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add task"}
            </Button>
            {error && (
              <span className="ml-3 text-sm text-red-600">{error}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
