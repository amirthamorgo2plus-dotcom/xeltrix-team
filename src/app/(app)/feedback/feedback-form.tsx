"use client";

import { useActionState, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createFeedback } from "./actions";
import { RATINGS } from "./ratings";

export function FeedbackForm({
  leads,
  jobs,
  today,
}: {
  leads: { id: string; name: string }[];
  jobs: { id: string; label: string }[];
  today: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createFeedback, undefined);
  const [rating, setRating] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record what a customer said</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <Label>Customer *</Label>
              <input
                name="customer_name"
                required
                list="feedback-customers"
                placeholder="Pick existing or type a new one"
                className="h-10 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
              />
              <datalist id="feedback-customers">
                {leads.map((l) => (
                  <option key={l.id} value={l.name} />
                ))}
              </datalist>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label>When they said it</Label>
              <Input name="received_on" type="date" defaultValue={today} max={today} />
            </div>
          </div>

          {/* Big tap targets: this gets filled in on a phone, standing in
              someone's kitchen, straight after the job. */}
          <div className="flex flex-col gap-1.5">
            <Label>How happy were they? *</Label>
            <input type="hidden" name="rating" value={rating ?? ""} />
            <div className="flex flex-wrap gap-2">
              {RATINGS.map((r) => {
                const on = rating === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRating(r.value)}
                    aria-pressed={on}
                    className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-xs transition ${
                      on
                        ? `${r.activeBorder} ${r.activeBg} ${r.activeText}`
                        : "border-zinc-300 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
                    }`}
                  >
                    <span className="text-base leading-none">{r.value}</span>
                    <span className="truncate">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <Label>Heard by</Label>
              <Select name="channel" defaultValue="phone">
                <option value="phone">Phone call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="in_person">In person</option>
                <option value="email">Email</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label>About a cleaning job</Label>
              <Select name="deep_cleaning_job_id" defaultValue="">
                <option value="">Not about one job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label>What they said</Label>
            <Textarea
              name="comment"
              rows={3}
              placeholder="Their words, as close as you can remember."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || rating === null}>
              {pending ? "Saving…" : "Save feedback"}
            </Button>
            {rating === null && (
              <span className="text-xs text-zinc-500">Pick a rating first.</span>
            )}
            {state?.ok && <span className="text-sm text-[#b5c76a]">Saved</span>}
            {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
