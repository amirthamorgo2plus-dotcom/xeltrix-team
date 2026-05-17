"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllPaid, resetMonth } from "./actions";

export function ActionsBar({ monthCursor }: { monthCursor: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (confirm(`Mark all items as paid for this month? Uses each item's budget as the actual.`)) {
            start(() => markAllPaid(monthCursor));
          }
        }}
      >
        Mark all paid
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (confirm(`Reset all paid marks for this month? This removes every payment row for this month.`)) {
            start(() => resetMonth(monthCursor));
          }
        }}
      >
        Reset month
      </Button>
    </div>
  );
}
