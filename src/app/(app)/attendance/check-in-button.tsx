"use client";

import { useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { checkIn, checkOut } from "./actions";

export function CheckInButton({
  todayRow,
}: {
  todayRow: {
    id: string;
    status: string;
    check_in_at: string | null;
    check_out_at: string | null;
    hours: number | null;
  } | null;
}) {
  const [pending, start] = useTransition();

  if (todayRow?.check_in_at && todayRow.check_out_at) {
    return (
      <div className="text-sm">
        <div>
          You worked{" "}
          <span className="font-semibold">{todayRow.hours?.toFixed(1) ?? "—"}h</span>{" "}
          today.
        </div>
        <div className="text-xs text-zinc-500">
          {format(new Date(todayRow.check_in_at), "HH:mm")} →{" "}
          {format(new Date(todayRow.check_out_at), "HH:mm")}
        </div>
      </div>
    );
  }

  if (todayRow?.check_in_at) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          Checked in at{" "}
          <span className="font-semibold">
            {format(new Date(todayRow.check_in_at), "HH:mm")}
          </span>
        </div>
        <Button disabled={pending} onClick={() => start(() => checkOut())}>
          {pending ? "..." : "Check out"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-zinc-500">Not checked in yet.</div>
      <Button disabled={pending} onClick={() => start(() => checkIn())}>
        {pending ? "..." : "Check in"}
      </Button>
    </div>
  );
}
