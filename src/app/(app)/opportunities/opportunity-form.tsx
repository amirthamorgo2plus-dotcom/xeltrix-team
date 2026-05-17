"use client";

import { useActionState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createOpportunity } from "./actions";

const STAGES = ["prospecting", "qualification", "proposal", "negotiation", "won", "lost"];

export function OpportunityForm({ leads }: { leads: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createOpportunity, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add opportunity</CardTitle>
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
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Title *</Label>
            <Input name="title" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Value</Label>
            <Input name="value" type="number" step="100" defaultValue="0" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Stage</Label>
            <Select name="stage" defaultValue="prospecting">
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Close date</Label>
            <Input name="close_date" type="date" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Linked lead</Label>
            <Select name="lead_id" defaultValue="">
              <option value="">— None —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-5">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add opportunity"}
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
