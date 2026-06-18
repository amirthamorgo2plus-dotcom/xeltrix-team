"use client";

import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { memberColor } from "@/lib/member-colors";
import {
  createStaff,
  inviteMember,
  resendMemberInvite,
  setAttendanceOnly,
  setMemberActive,
  setTrackAttendance,
} from "./actions";

function ResendButton({ memberId }: { memberId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await resendMemberInvite(memberId);
            setNote(r.error ? r.error : "Sent");
            setTimeout(() => setNote(null), 4000);
          })
        }
      >
        Resend
      </Button>
      {note && <span className="text-xs text-zinc-500">{note}</span>}
    </span>
  );
}

function InviteForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      const res = await inviteMember(undefined, fd);
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
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-medium">Invite a user (by email)</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Adds them to this organization and emails a sign-in link. They sign in with the 6-digit
        code (no password).
      </p>
      <form ref={ref} action={submit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label>Email *</Label>
          <Input name="email" type="email" required placeholder="person@company.com" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Role</Label>
          <Select name="role" defaultValue="member">
            <option value="member">Member</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Inviting…" : "Invite user"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
        {ok && (
          <p className="text-sm text-emerald-600 sm:col-span-4">
            Invited — they&apos;ll get a sign-in email and appear in the list.
          </p>
        )}
      </form>
    </div>
  );
}

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
      <Table>
        <THead>
          <TR hover={false}>
            <TH>Member</TH>
            <TH>Role</TH>
            <TH>In attendance</TH>
            <TH>Access</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {members.map((m) => (
            <TR key={m.id} className={m.active ? "" : "opacity-60"}>
              <TD className="font-medium">
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${memberColor(m.id).dot}`} />
                  {m.name}
                </span>
              </TD>
              <TD className="capitalize text-zinc-500">{m.role}</TD>
              <TD>
                <Toggle
                  on={m.track_attendance}
                  onLabel="Tracked ✓"
                  offLabel="Hidden"
                  onClick={() => setTrackAttendance(m.id, !m.track_attendance)}
                />
              </TD>
              <TD>
                {m.role === "member" ? (
                  <div className="flex items-center gap-2">
                    <Badge tone={m.attendance_only ? "info" : "success"}>
                      {m.attendance_only ? "Attendance only" : "Full access"}
                    </Badge>
                    <Toggle
                      on={m.attendance_only}
                      onLabel="Give full access"
                      offLabel="Limit to attendance"
                      onClick={() => setAttendanceOnly(m.id, !m.attendance_only)}
                    />
                  </div>
                ) : (
                  <Badge tone="success">Full access</Badge>
                )}
              </TD>
              <TD>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={m.active ? "success" : "muted"}>
                    {m.active ? "Active" : "Inactive"}
                  </Badge>
                  <Toggle
                    on={m.active}
                    onLabel="Deactivate"
                    offLabel="Reactivate"
                    onClick={() => setMemberActive(m.id, !m.active)}
                  />
                  {!m.attendance_only && <ResendButton memberId={m.id} />}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <InviteForm />

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
