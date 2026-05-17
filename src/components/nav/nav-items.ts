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
  Plug,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",     label: "Dashboard",  icon: LayoutDashboard },
  { href: "/leads",         label: "Leads",      icon: Users },
  { href: "/opportunities", label: "Pipeline",   icon: Briefcase },
  { href: "/tasks",         label: "Tasks",      icon: CheckSquare },
  { href: "/follow-ups",    label: "Follow-ups", icon: Bell },
  { href: "/complaints",    label: "Complaints", icon: AlertCircle },
  { href: "/attendance",    label: "Attendance", icon: Clock },
  { href: "/calendar",      label: "Calendar",   icon: CalendarDays },
  { href: "/holidays",      label: "Holidays",   icon: CalendarHeart },
  { href: "/targets",       label: "Targets",    icon: Target },
  { href: "/integrations",  label: "Integrations", icon: Plug },
  { href: "/profile",       label: "Profile",    icon: User },
];
