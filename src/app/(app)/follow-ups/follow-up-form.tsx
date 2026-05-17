"use client";

import { useActionState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createFollowUp } from "./actions";

export function FollowUpForm({ leads }: { leads: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createFollowUp, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add follow-up</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            ref.current?.reset();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div className="flex flex-col gap-1">
            <Label>Lead *</Label>
            <Select name="lead_id" required defaultValue="">
              <option value="" disabled>
                Select a lead…
              </option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Due *</Label>
            <Input name="due_at" type="datetime-local" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Channel</Label>
            <Input name="channel" placeholder="call / email / whatsapp" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <Label>Notes</Label>
            <Textarea name="notes" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add follow-up"}
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
