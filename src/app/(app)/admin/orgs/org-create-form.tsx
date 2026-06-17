"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrg } from "./actions";

export function OrgCreateForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      const res = await createOrg(undefined, fd);
      if (res?.error) {
        setError(res.error);
        setOk(false);
      } else {
        setError(null);
        setOk(true);
        ref.current?.reset();
      }
    });
  }

  return (
    <form ref={ref} action={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <Label>Organization name *</Label>
        <Input name="name" required placeholder="e.g. Acme Pvt Ltd" />
      </div>
      <div className="flex flex-col gap-1">
        <Label>First admin email *</Label>
        <Input name="admin_email" type="email" required placeholder="admin@acme.com" />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" /> {pending ? "Creating…" : "Create org"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
      {ok && (
        <p className="text-sm text-emerald-600 sm:col-span-3">
          Organization created. The admin can sign in with their email (magic link) and will land
          in the new org.
        </p>
      )}
    </form>
  );
}
