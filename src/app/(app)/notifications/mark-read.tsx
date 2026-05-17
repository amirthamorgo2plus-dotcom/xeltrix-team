"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllRead } from "./actions";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(() => markAllRead())}
    >
      {pending ? "..." : "Mark all read"}
    </Button>
  );
}
