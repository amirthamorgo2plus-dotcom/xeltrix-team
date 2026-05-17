"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteHoliday } from "./actions";

export function DeleteHolidayButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => start(() => deleteHoliday(id))}
      aria-label="Delete holiday"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
