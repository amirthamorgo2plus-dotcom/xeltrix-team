"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteOrg, renameOrg, resendInvite } from "./actions";

export function OrgRowActions({
  teamId,
  name,
  adminEmails,
}: {
  teamId: string;
  name: string;
  adminEmails: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function flash(msg: string) {
    setNote(msg);
    setTimeout(() => setNote(null), 4000);
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {note && <span className="mr-1 text-xs text-emerald-600">{note}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        title={
          adminEmails.length
            ? `Resend sign-in link to ${adminEmails.join(", ")}`
            : "Resend sign-in link to the org admin"
        }
        onClick={() => {
          const to = adminEmails.join(", ") || "the org admin";
          if (!window.confirm(`Resend sign-in link to ${to}?`)) return;
          start(async () => {
            const res = await resendInvite(teamId);
            flash(res.error ? res.error : `Sent to ${to}`);
          });
        }}
      >
        <Mail className="h-4 w-4" /> Resend
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        title="Rename organization"
        onClick={() => {
          const next = window.prompt("Rename organization", name);
          if (next && next.trim() && next.trim() !== name) {
            start(async () => {
              const res = await renameOrg(teamId, next);
              if (res.error) flash(res.error);
              else router.refresh();
            });
          }
        }}
      >
        <Pencil className="h-4 w-4" /> Rename
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-red-600"
        disabled={pending}
        aria-label="Delete organization"
        title="Delete organization and ALL its data"
        onClick={() => {
          if (
            window.confirm(
              `Delete "${name}" and ALL its data (members, leads, tasks, attendance, etc.)?\n\nThis cannot be undone.`
            ) &&
            window.confirm("Are you absolutely sure? This permanently erases the org.")
          ) {
            start(async () => {
              const res = await deleteOrg(teamId);
              if (res.error) flash(res.error);
              else router.refresh();
            });
          }
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
