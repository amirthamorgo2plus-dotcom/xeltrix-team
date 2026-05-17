"use client";

import { useActionState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createHoliday } from "./actions";

export function HolidayForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createHoliday, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add holiday</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={async (fd) => {
            await action(fd);
            formRef.current?.reset();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-5"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" required />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="e.g. Diwali" required />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="working_allowed" />
            Working allowed
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="tentative" />
            Tentative
          </label>
          <div className="sm:col-span-5">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add"}
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
