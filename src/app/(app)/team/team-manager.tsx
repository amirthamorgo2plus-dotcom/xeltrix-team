"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createStaff,
  setAttendanceOnly,
  setMemberActive,
  setTrackAttendance,
} from "./actions";

export type TeamMemberRow = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  track_attendance: boolean;
  attendance_only: boolean;
};

function Toggle({
  on,
  onLabel,
  offLabel,
  onClick,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onClick: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(onClick)}
    >
      {on ? onLabel : offLabel}
    </Button>
  );
}

export function TeamManager({ members }: { members: TeamMemberRow[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function addStaff(fd: FormData) {
    start(async () => {
      const res = await createStaff(undefined, fd);
      if (res?.error) {
        setError(res.error);
        setOk(false);
      } else {
        setError(null);
        setOk(true);
        ref.current?.reset();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="pb-2 pr-4">Member</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">In attendance</th>
              <th className="pb-2 pr-4">Access</th>
              <th className="pb-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4 font-medium">{m.name}</td>
                <td className="py-2 pr-4 capitalize text-zinc-500">{m.role}</td>
                <td className="py-2 pr-4">
                  <Toggle
                    on={m.track_attendance}
                    onLabel="Tracked ✓"
                    offLabel="Hidden"
                    onClick={() => setTrackAttendance(m.id, !m.track_attendance)}
                  />
                </td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    {m.attendance_only && <Badge tone="info">Attendance only</Badge>}
                    <Toggle
                      on={m.attendance_only}
                      onLabel="Make full access"
                      offLabel="Limit to attendance"
                      onClick={() => setAttendanceOnly(m.id, !m.attendance_only)}
                    />
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <Badge tone={m.active ? "success" : "muted"}>
                      {m.active ? "Active" : "Inactive"}
                    </Badge>
                    <Toggle
                      on={m.active}
                      onLabel="Deactivate"
                      offLabel="Reactivate"
                      onClick={() => setMemberActive(m.id, !m.active)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium">Add staff (no email)</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Creates an attendance-only login. They sign in with the username + PIN on the login
          screen (“Staff sign-in”). PIN must be at least 6 characters.
        </p>
        <form
          ref={ref}
          action={addStaff}
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <div className="flex flex-col gap-1">
            <Label>Full name *</Label>
            <Input name="name" required placeholder="e.g. Ravi Kumar" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Username *</Label>
            <Input name="username" required placeholder="e.g. ravi" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>PIN * (6+ chars)</Label>
            <Input name="pin" type="text" required placeholder="e.g. 246810" autoComplete="off" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add staff"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
          {ok && (
            <p className="text-sm text-emerald-600 sm:col-span-4">
              Staff added — they can sign in now.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
