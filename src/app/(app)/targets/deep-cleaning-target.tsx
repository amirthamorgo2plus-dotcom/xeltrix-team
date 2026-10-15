"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setDeepCleaningTarget } from "./actions";

export function DeepCleaningTargetForm({
  month,
  current,
}: {
  month: string;
  current: number | null;
}) {
  const [state, action, pending] = useActionState(setDeepCleaningTarget, undefined);

  return (
    <form
      action={async (fd) => {
        await action(fd);
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="month" value={month} />
      <div className="flex flex-col gap-1">
        <Label>Target for this month</Label>
        <Input
          name="amount"
          type="number"
          // step="1000" would make the browser silently refuse anything that
          // is not a round thousand -- a target of 62,500 could not be typed.
          step="1"
          min="0"
          // Keyed on the month so moving between months reloads the field
          // instead of keeping whatever was last typed.
          key={`${month}:${current ?? ""}`}
          defaultValue={current ?? ""}
          placeholder="Not set"
          className="w-40"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : current == null ? "Set target" : "Update"}
      </Button>
      <span className="text-xs text-zinc-500">Leave blank and save to clear it.</span>
      {state?.error && <span className="w-full text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
