"use client";

import { useActionState, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createRoutine } from "./actions";

const WEEKDAYS = [
  { v: 1, l: "Monday" },
  { v: 2, l: "Tuesday" },
  { v: 3, l: "Wednesday" },
  { v: 4, l: "Thursday" },
  { v: 5, l: "Friday" },
  { v: 6, l: "Saturday" },
  { v: 0, l: "Sunday" },
];

export function RoutineForm({ members }: { members: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createRoutine, undefined);
  const [cadence, setCadence] = useState("weekly");
  const [mode, setMode] = useState("member");
  const [perPerson, setPerPerson] = useState(false);

  const ownerRequired = !(mode === "everyone" && perPerson);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add routine</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            ref.current?.reset();
            setCadence("weekly");
            setMode("member");
            setPerPerson(false);
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Title *</Label>
            <Input name="title" placeholder="e.g. Saturday meeting" required />
          </div>

          <div className="flex flex-col gap-1">
            <Label>Repeats *</Label>
            <Select name="cadence" value={cadence} onChange={(e) => setCadence(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>

          {cadence === "weekly" && (
            <div className="flex flex-col gap-1">
              <Label>On *</Label>
              <Select name="weekday" defaultValue={6}>
                {WEEKDAYS.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.l}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {cadence === "monthly" && (
            <div className="flex flex-col gap-1">
              <Label>Day of month *</Label>
              <Input name="day_of_month" type="number" min={1} max={31} defaultValue={1} />
            </div>
          )}

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
            <Label>Assign to</Label>
            <Select name="assignee_mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="member">One person</option>
              <option value="everyone">Everyone</option>
            </Select>
          </div>

          {mode === "everyone" && (
            <div className="flex items-end gap-2 sm:col-span-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="per_person"
                  checked={perPerson}
                  onChange={(e) => setPerPerson(e.target.checked)}
                />
                One task per person
              </label>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label>{ownerRequired ? "Owner *" : "Owner"}</Label>
            <Select name="owner_id" defaultValue="" disabled={!ownerRequired}>
              <option value="">{ownerRequired ? "Select…" : "— each person —"}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-4">
            <Label>Description</Label>
            <Textarea name="description" placeholder="What needs doing each time" />
          </div>

          <div className="sm:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add routine"}
            </Button>
            {state?.error && <span className="ml-3 text-sm text-red-600">{state.error}</span>}
            <p className="mt-2 text-xs text-zinc-500">
              Tasks are created automatically each period when someone opens Tasks — no need to add
              them by hand. &quot;One task per person&quot; gives every active member their own copy
              (e.g. WhatsApp follow-ups); otherwise one shared task goes to the owner.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
