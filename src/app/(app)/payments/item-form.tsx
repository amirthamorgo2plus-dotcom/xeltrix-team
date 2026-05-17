"use client";

import { useActionState, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { upsertItem, seedDefaults } from "./actions";

const MONTHS = [
  ["1", "January"], ["2", "February"], ["3", "March"], ["4", "April"],
  ["5", "May"], ["6", "June"], ["7", "July"], ["8", "August"],
  ["9", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
];

export function ItemForm({
  categories,
  mode = "add",
}: {
  categories: string[];
  mode?: "add" | "seed-or-add";
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(upsertItem, undefined);

  function handleSeed() {
    if (!confirm("Seed 21 default recurring items? You can edit or delete any later.")) return;
    seedDefaults();
  }

  if (mode === "seed-or-add" && !open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSeed}>Seed default items</Button>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add item manually
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add recurring item
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add recurring item</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            if (!state?.error) {
              ref.current?.reset();
              setOpen(false);
            }
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Name *</Label>
            <Input name="name" required placeholder="e.g. Office Rent" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Category *</Label>
            <Select name="category" required defaultValue={categories[0]}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Frequency</Label>
            <Select name="frequency" defaultValue="Monthly">
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Annual</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Budget (₹)</Label>
            <Input name="budget" type="number" step="0.01" defaultValue="0" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Due day (1-31)</Label>
            <Input name="due_day" type="number" min="1" max="31" defaultValue="1" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Due month (Annual / Quarterly)</Label>
            <Select name="due_month" defaultValue="">
              <option value="">—</option>
              {MONTHS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Reminder days before due</Label>
            <Input name="reminder_days" type="number" min="0" defaultValue="3" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <Label>Notes</Label>
            <Textarea name="notes" />
          </div>
          <div className="flex items-center gap-3 sm:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save item"}
            </Button>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {state?.error && (
              <span className="text-sm text-red-600">{state.error}</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
