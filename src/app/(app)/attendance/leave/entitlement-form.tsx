"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAnnualLeaveDays } from "./actions";

export function EntitlementForm({
  current,
  canManage,
}: {
  current: number | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current == null ? "" : String(current));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  if (!canManage) {
    return (
      <p className="text-sm text-zinc-500">
        {current == null
          ? "No annual leave allowance has been set yet — an admin or manager can set one."
          : `Everyone is entitled to ${current} day${current === 1 ? "" : "s"} of paid leave a year.`}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="annual-leave">Paid leave days per year</Label>
          <Input
            id="annual-leave"
            type="number"
            min="0"
            max="365"
            step="0.5"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. 12"
            className="w-40"
          />
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            setError(null);
            setSaved(false);
            const trimmed = value.trim();
            start(async () => {
              const res = await setAnnualLeaveDays(trimmed === "" ? null : Number(trimmed));
              if (res.error) {
                setError(res.error);
                return;
              }
              setSaved(true);
              router.refresh();
            });
          }}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-sm text-[#b5c76a]">Saved</span>}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500">
        Applies to everyone. Comp-off is tracked separately and is not affected.
      </p>
    </div>
  );
}
