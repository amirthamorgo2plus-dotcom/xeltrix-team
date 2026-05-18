"use client";

import { useActionState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { submitExpense } from "./actions";

export function SubmissionForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(submitExpense, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit an expense</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            if (!state?.error) ref.current?.reset();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <div className="flex flex-col gap-1">
            <Label>Date *</Label>
            <Input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Description *</Label>
            <Input
              name="description"
              placeholder="e.g. Sasi (Welthoil) / Porter / Lunch expenses"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Amount (₹) *</Label>
            <Input name="amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Category</Label>
            <Input
              name="category"
              placeholder="e.g. Freight, Lunch, Material"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <Label>Notes</Label>
            <Textarea name="notes" placeholder="Anything to remember" />
          </div>
          <div className="flex items-center gap-3 sm:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit for verification"}
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
