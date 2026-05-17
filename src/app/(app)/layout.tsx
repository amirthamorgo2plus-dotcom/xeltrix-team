import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data";
import { Sidebar } from "@/components/nav/sidebar";
import { NotificationBell } from "@/components/nav/notification-bell";
import { Avatar } from "@/components/ui/avatar";

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

  const profile = await getMyProfile();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-6 dark:border-zinc-800">
          <div className="text-sm text-zinc-500">
            <Link href="/profile" className="inline-flex items-center gap-2 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Avatar src={profile?.avatar_url} name={profile?.full_name ?? user.email} size={24} />
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {profile?.full_name ?? user.email}
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
