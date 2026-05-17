"use client";

import { useActionState, useRef } from "react";
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
  const [state, action, pending] = useActionState(createTask, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add task</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            ref.current?.reset();
          }}
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
            {state?.error && (
              <span className="ml-3 text-sm text-red-600">{state.error}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
