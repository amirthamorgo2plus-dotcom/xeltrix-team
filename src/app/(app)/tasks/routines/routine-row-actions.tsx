"use client";

import { useTransition } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteRoutine, toggleRoutine } from "./actions";

export function RoutineRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => start(() => toggleRoutine(id, !active))}
      >
        {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {active ? "Pause" : "Resume"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-red-600"
        disabled={pending}
        aria-label="Delete routine"
        onClick={() => {
          if (confirm("Delete this routine? Existing tasks stay; no new ones are created."))
            start(() => deleteRoutine(id));
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
