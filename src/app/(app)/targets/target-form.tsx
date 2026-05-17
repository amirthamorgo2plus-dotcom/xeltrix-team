"use client";

import { useActionState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { setTarget } from "./actions";

export function TargetForm({
  members,
  defaultMonth,
}: {
  members: { id: string; name: string }[];
  defaultMonth: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(setTarget, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set monthly target</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <div className="flex flex-col gap-1">
            <Label>Member *</Label>
            <Select name="member_id" required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Month *</Label>
            <Input name="month" type="month" defaultValue={defaultMonth} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Target amount *</Label>
            <Input name="amount" type="number" step="1000" required />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Set target"}
            </Button>
          </div>
          {state?.error && (
            <div className="sm:col-span-4">
              <span className="text-sm text-red-600">{state.error}</span>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
