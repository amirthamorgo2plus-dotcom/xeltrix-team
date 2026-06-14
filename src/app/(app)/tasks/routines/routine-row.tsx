"use client";

import { useState, useTransition } from "react";
import { Pencil, Pause, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteRoutine, toggleRoutine, updateRoutine } from "./actions";

export type RoutineData = {
  id: string;
  title: string;
  description: string | null;
  cadence: string;
  weekday: number | null;
  day_of_month: number | null;
  assignee_mode: string;
  owner_id: string | null;
  per_person: boolean;
  priority: string;
  active: boolean;
};

const WEEKDAYS = [
  { v: 1, l: "Monday" },
  { v: 2, l: "Tuesday" },
  { v: 3, l: "Wednesday" },
  { v: 4, l: "Thursday" },
  { v: 5, l: "Friday" },
  { v: 6, l: "Saturday" },
  { v: 0, l: "Sunday" },
];
const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cadenceLabel(r: RoutineData) {
  if (r.cadence === "weekly") return `Weekly · ${WEEKDAY_LABEL[r.weekday ?? 1]}`;
  if (r.cadence === "monthly") return `Monthly · day ${r.day_of_month ?? 1}`;
  return "Daily";
}

export function RoutineRow({
  routine,
  members,
}: {
  routine: RoutineData;
  members: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [cadence, setCadence] = useState(routine.cadence);
  const [mode, setMode] = useState(routine.assignee_mode);
  const [perPerson, setPerPerson] = useState(routine.per_person);
  const ownerRequired = !(mode === "everyone" && perPerson);

  const memberName = members.find((m) => m.id === routine.owner_id)?.name ?? "—";
  const assigned =
    routine.assignee_mode === "everyone" && routine.per_person
      ? "Everyone (per person)"
      : memberName;

  function save(fd: FormData) {
    start(async () => {
      const res = await updateRoutine(routine.id, fd);
      if (res?.error) setError(res.error);
      else {
        setError(null);
        setEditing(false);
      }
    });
  }

  return (
    <>
      <tr className="border-t border-zinc-200 dark:border-zinc-800">
        <td className="py-2 pr-4">
          <div className="font-medium">{routine.title}</div>
          {routine.description && (
            <div className="text-xs text-zinc-500">{routine.description}</div>
          )}
        </td>
        <td className="py-2 pr-4">{cadenceLabel(routine)}</td>
        <td className="py-2 pr-4">{assigned}</td>
        <td className="py-2 pr-4">
          <Badge tone={routine.active ? "success" : "muted"}>
            {routine.active ? "Active" : "Paused"}
          </Badge>
        </td>
        <td className="py-2">
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing((v) => !v);
                setError(null);
              }}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => start(() => toggleRoutine(routine.id, !routine.active))}
            >
              {routine.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {routine.active ? "Pause" : "Resume"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-red-600"
              disabled={pending}
              aria-label="Delete routine"
              onClick={() => {
                if (confirm("Delete this routine? Existing tasks stay; no new ones are created."))
                  start(() => deleteRoutine(routine.id));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>

      {editing && (
        <tr className="border-t border-zinc-100 dark:border-zinc-900">
          <td colSpan={5} className="py-3">
            <form action={save} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label>Title *</Label>
                <Input name="title" defaultValue={routine.title} required />
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
                  <Select name="weekday" defaultValue={routine.weekday ?? 6}>
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
                  <Input
                    name="day_of_month"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={routine.day_of_month ?? 1}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <Label>Priority</Label>
                <Select name="priority" defaultValue={routine.priority}>
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
                <div className="flex items-end gap-2">
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
                <Select
                  name="owner_id"
                  defaultValue={routine.owner_id ?? ""}
                  disabled={!ownerRequired}
                >
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
                <Textarea name="description" defaultValue={routine.description ?? ""} />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-2"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                {error && <span className="ml-3 text-sm text-red-600">{error}</span>}
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
