import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/molec.png" alt="Xeltrix" className="h-20 w-20" />
          <h1 className="text-2xl font-semibold">Xeltrix Team</h1>
          <CardTitle>Sign in to continue</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm searchParamsPromise={searchParams} />
        </CardContent>
      </Card>
    </main>
  );
}
