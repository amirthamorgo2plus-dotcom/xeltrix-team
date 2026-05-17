"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile } from "./actions";

export function ProfileForm({
  defaultName,
  defaultPhone,
  defaultTimezone,
}: {
  defaultName: string;
  defaultPhone: string;
  defaultTimezone: string;
}) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label>Full name</Label>
        <Input name="full_name" defaultValue={defaultName} />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Phone</Label>
        <Input name="phone" defaultValue={defaultPhone} />
      </div>
      <div className="flex flex-col gap-1">
        <Label>Timezone</Label>
        <Input name="timezone" defaultValue={defaultTimezone} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        {state?.ok && <span className="text-sm text-emerald-600">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
