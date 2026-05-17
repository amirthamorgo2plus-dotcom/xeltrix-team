"use client";

import { useActionState, use } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { sendMagicLink } from "./actions";

type State = { ok?: boolean; error?: string };

export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = use(searchParamsPromise);
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => sendMagicLink(formData),
    {}
  );

  const sent = state.ok || sp.sent === "1";
  const error = state.error || sp.error;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@xeltrix.com"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Email me a magic link"}
      </Button>

      {sent && (
        <p className="text-sm text-emerald-600">
          Check your email for a sign-in link.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-zinc-500">
        We&apos;ll send a one-tap sign-in link to your inbox. No password required.
      </p>
    </form>
  );
}
