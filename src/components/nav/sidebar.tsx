import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Target,
  AlertCircle,
  CalendarDays,
  Clock,
  Briefcase,
  Bell,
  CalendarHeart,
  User,
} from "lucide-react";

const nav = [
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
  { href: "/leads",        label: "Leads",         icon: Users },
  { href: "/opportunities", label: "Pipeline",     icon: Briefcase },
  { href: "/tasks",        label: "Tasks",         icon: CheckSquare },
  { href: "/follow-ups",   label: "Follow-ups",    icon: Bell },
  { href: "/complaints",   label: "Complaints",    icon: AlertCircle },
  { href: "/attendance",   label: "Attendance",    icon: Clock },
  { href: "/calendar",     label: "Calendar",      icon: CalendarDays },
  { href: "/holidays",     label: "Holidays",      icon: CalendarHeart },
  { href: "/targets",      label: "Targets",       icon: Target },
  { href: "/profile",      label: "Profile",       icon: User },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 px-2 text-lg font-semibold">Xeltrix Team</div>
      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
