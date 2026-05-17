"use client";

import { useActionState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createLead } from "./actions";

const STATUSES = ["new", "contacted", "qualified", "unqualified", "converted", "lost"];

export function LeadForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createLead, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add lead</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            ref.current?.reset();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <Label>Name *</Label>
            <Input name="name" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Status</Label>
            <Select name="status" defaultValue="new">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Email</Label>
            <Input name="email" type="email" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Phone</Label>
            <Input name="phone" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Source</Label>
            <Input name="source" placeholder="referral / web / cold" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea name="notes" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add lead"}
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
