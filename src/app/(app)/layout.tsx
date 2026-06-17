import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, getMyMembership, getMyTeams } from "@/lib/data";
import { isSuperAdmin } from "@/lib/super-admin";
import { Sidebar } from "@/components/nav/sidebar";
import { MobileNav } from "@/components/nav/mobile-nav";
import { NotificationBell } from "@/components/nav/notification-bell";
import { WorldClocks } from "@/components/nav/world-clocks";
import { OrgSwitcher } from "@/components/nav/org-switcher";
import { InstallHint } from "@/components/install-hint";
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
  const membership = await getMyMembership();
  const teams = await getMyTeams();
  const superAdmin = await isSuperAdmin();
  const role = membership?.role ?? null;
  const attendanceOnly =
    (membership as { attendance_only?: boolean } | null)?.attendance_only === true;

  // User belongs to no organization yet — they must be added/provisioned.
  if (!membership) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-lg font-semibold">No organization yet</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your account isn&apos;t part of any organization. Ask your administrator to add you,
            then sign in again.
          </p>
          <p className="mt-1 text-xs text-zinc-400">{user.email}</p>
          <form action="/auth/signout" method="post" className="mt-4">
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const identity = (
    <span className="inline-flex items-center gap-2 truncate">
      <Avatar src={profile?.avatar_url} name={profile?.full_name ?? user.email} size={24} />
      <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
        {profile?.full_name ?? user.email}
      </span>
    </span>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} attendanceOnly={attendanceOnly} superAdmin={superAdmin} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b border-zinc-200 px-4 md:px-6 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm text-zinc-500 min-w-0">
            <MobileNav role={role} attendanceOnly={attendanceOnly} />
            {attendanceOnly ? (
              identity
            ) : (
              <Link
                href="/profile"
                className="truncate hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {identity}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <OrgSwitcher teams={teams} current={membership.team_id} />
            {!attendanceOnly && <WorldClocks />}
            {!attendanceOnly && <NotificationBell />}
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
        <InstallHint />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
