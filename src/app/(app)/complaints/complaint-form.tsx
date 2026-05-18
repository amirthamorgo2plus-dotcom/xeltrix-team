"use client";

import { useActionState, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createComplaint } from "./actions";

export function ComplaintForm({
  leads,
}: {
  leads: { id: string; name: string; email: string | null }[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createComplaint, undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleNameChange(v: string) {
    setName(v);
    const match = leads.find(
      (l) => l.name.toLowerCase() === v.trim().toLowerCase()
    );
    if (match && match.email) setEmail(match.email);
  }

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
            if (!state?.error) {
              ref.current?.reset();
              setName("");
              setEmail("");
            }
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <Label>Customer name *</Label>
            <input
              name="customer_name"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              list="lead-names"
              placeholder="Pick existing or type a new one"
              className="h-10 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
            />
            <datalist id="lead-names">
              {leads.map((l) => (
                <option key={l.id} value={l.name} />
              ))}
            </datalist>
            <p className="text-[10px] text-zinc-500">
              Type to search · names not in the list become new leads.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Customer email</Label>
            <Input
              name="customer_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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
