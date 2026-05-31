"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { deleteVisit, updateVisit } from "./actions";

type Lead = { id: string; name: string };

export function VisitRowActions({
  visitId,
  defaults,
  leads,
}: {
  visitId: string;
  defaults: {
    lead_id: string | null;
    notes: string | null;
    check_in_at: string;
    check_out_at: string | null;
  };
  leads: Lead[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // datetime-local needs "yyyy-MM-ddTHH:mm" in local time
  function toLocalDtInput(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function handleDelete() {
    if (!confirm("Delete this visit? Cannot be undone.")) return;
    start(async () => {
      try {
        await deleteVisit(visitId);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3 w-3" /> Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700"
          disabled={pending}
          onClick={handleDelete}
        >
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        setErr(null);
        start(async () => {
          try {
            await updateVisit(visitId, fd);
            setEditing(false);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Save failed");
          }
        });
      }}
      className="mt-2 grid grid-cols-1 gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>Customer</Label>
        <Select name="lead_id" defaultValue={defaults.lead_id ?? ""}>
          <option value="">— no customer —</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label>Check-in</Label>
        <Input
          type="datetime-local"
          name="check_in_at"
          defaultValue={toLocalDtInput(defaults.check_in_at)}
          className="h-9 text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Check-out</Label>
        <Input
          type="datetime-local"
          name="check_out_at"
          defaultValue={toLocalDtInput(defaults.check_out_at)}
          className="h-9 text-xs"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>Notes</Label>
        <Textarea
          name="notes"
          defaultValue={defaults.notes ?? ""}
          rows={2}
          className="text-xs"
        />
      </div>
      {err && <div className="text-xs text-red-600 sm:col-span-2">{err}</div>}
      <div className="flex gap-2 sm:col-span-2">
        <Button size="sm" type="submit" disabled={pending}>
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          type="button"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setErr(null);
          }}
        >
          <X className="h-3 w-3" /> Cancel
        </Button>
      </div>
    </form>
  );
}
