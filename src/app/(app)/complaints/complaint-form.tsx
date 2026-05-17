"use client";

import { useActionState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createComplaint } from "./actions";

export function ComplaintForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createComplaint, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log complaint</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={ref}
          action={async (fd) => {
            await action(fd);
            ref.current?.reset();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <Label>Customer name *</Label>
            <Input name="customer_name" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Customer email</Label>
            <Input name="customer_email" type="email" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Subject *</Label>
            <Input name="subject" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Severity</Label>
            <Select name="severity" defaultValue="medium">
              <option>low</option>
              <option>medium</option>
              <option>high</option>
              <option>critical</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label>Description</Label>
            <Textarea name="description" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Log complaint"}
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
