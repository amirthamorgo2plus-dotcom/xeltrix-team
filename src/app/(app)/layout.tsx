import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-6 dark:border-zinc-800">
          <div className="text-sm text-zinc-500">
            Signed in as <span className="font-medium text-zinc-900 dark:text-zinc-100">{user.email}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
