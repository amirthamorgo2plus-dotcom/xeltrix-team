"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { sendMagicLink, verifyCode } from "./actions";

export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = use(searchParamsPromise);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(sp.sent === "1");
  const [error, setError] = useState<string | null>(sp.error ?? null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const fd = new FormData();
    fd.set("email", email);
    const res = await sendMagicLink(fd);
    setSending(false);
    if (res.error) setError(res.error);
    else setSent(true);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("token", code);
    const res = await verifyCode(fd);
    setVerifying(false);
    if (res.error) setError(res.error);
    else if (res.verified) router.push("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSend} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@xeltrix.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={sending}>
          {sending ? "Sending..." : "Email me a sign-in link & code"}
        </Button>
      </form>

      {sent && (
        <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-sm text-emerald-600">
            Check your email. Tap the link, or enter the code below.
          </p>
          <form onSubmit={handleVerify} className="flex flex-col gap-2">
            <Label htmlFor="token">Code from email</Label>
            <div className="flex gap-2">
              <Input
                id="token"
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter the code"
                maxLength={10}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
              />
              <Button type="submit" disabled={verifying || code.length < 6}>
                {verifying ? "Verifying..." : "Verify"}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              On iPhone, the code is the reliable option if tapping the link
              shows an error.
            </p>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-zinc-500">
        We&apos;ll email you a one-tap link and a 6-digit code. No password
        required.
      </p>
    </div>
  );
}
