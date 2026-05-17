"use client";

import { useActionState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { markAttendance } from "./actions";

const STATUSES = ["present", "absent", "half_day", "leave", "wfh", "holiday_worked"];

export function MarkAttendanceForm({ members }: { members: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(markAttendance, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mark attendance (manager)</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            ref.current?.reset();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-5"
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
            <Label>Date *</Label>
            <Input name="date" type="date" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Status *</Label>
            <Select name="status" required defaultValue="present">
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Hours</Label>
            <Input name="hours" type="number" step="0.25" placeholder="8" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Note</Label>
            <Input name="note" placeholder="optional" />
          </div>
          <div className="sm:col-span-5">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
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
