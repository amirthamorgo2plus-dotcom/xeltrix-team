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
  Package,
  FileText,
  UserCog,
  Wallet,
  Receipt,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/leads",         label: "Leads",         icon: Users },
  { href: "/opportunities", label: "Pipeline",      icon: Briefcase },
  { href: "/quotes",        label: "Quotes",        icon: FileText },
  { href: "/tasks",         label: "Tasks",         icon: CheckSquare },
  { href: "/follow-ups",    label: "Follow-ups",    icon: Bell },
  { href: "/complaints",    label: "Complaints",    icon: AlertCircle },
  { href: "/attendance",    label: "Attendance",    icon: Clock },
  { href: "/calendar",      label: "Calendar",      icon: CalendarDays },
  { href: "/holidays",      label: "Holidays",      icon: CalendarHeart },
  { href: "/targets",       label: "Targets",       icon: Target },
  { href: "/salespersons",  label: "Salespersons",  icon: UserCog },
  { href: "/templates",     label: "Templates",     icon: Package },
  { href: "/expenses",      label: "Expenses",      icon: Receipt },
  { href: "/visits",        label: "Visits",        icon: MapPin },
  { href: "/payments",      label: "Payments",      icon: Wallet,  adminOnly: true },
  { href: "/integrations",  label: "Integrations",  icon: Plug,    adminOnly: true },
  { href: "/profile",       label: "Profile",       icon: User },
];

export function visibleNavItems(role: string | null | undefined): NavItem[] {
  const isAdmin = role === "admin" || role === "manager";
  return NAV_ITEMS.filter((it) => !it.adminOnly || isAdmin);
}
