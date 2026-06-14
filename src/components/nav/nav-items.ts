import {
  LayoutGrid,
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
  ClipboardList,
  Repeat,
  User,
  Plug,
  Package,
  FileText,
  UserCog,
  Wallet,
  Receipt,
  MapPin,
  QrCode,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  // Sub-tabs shown when the parent is expanded. The parent is still a real
  // link: clicking it navigates to `href` AND expands its children.
  children?: NavItem[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/hub", label: "Command Center", icon: LayoutGrid },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/leads",
    label: "Leads",
    icon: Users,
    children: [
      { href: "/opportunities", label: "Pipeline",   icon: Briefcase },
      { href: "/quotes",        label: "Quotes",     icon: FileText },
      { href: "/follow-ups",    label: "Follow-ups", icon: Bell },
      { href: "/complaints",    label: "Complaints", icon: AlertCircle },
    ],
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: Clock,
    children: [
      { href: "/holidays", label: "Holidays", icon: CalendarHeart },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: CheckSquare,
    children: [
      { href: "/tasks/report", label: "Pending report", icon: ClipboardList },
      { href: "/tasks/routines", label: "Routines", icon: Repeat, adminOnly: true },
    ],
  },
  { href: "/visits", label: "Visits", icon: MapPin },
  { href: "/payment-qr", label: "Payment QR", icon: QrCode },
  {
    href: "/targets",
    label: "Targets",
    icon: Target,
    children: [
      { href: "/salespersons", label: "Salesperson performance", icon: UserCog },
    ],
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: Receipt,
    children: [
      { href: "/payments", label: "Payments", icon: Wallet, adminOnly: true },
    ],
  },
  { href: "/templates", label: "Product price list", icon: Package },
  { href: "/integrations", label: "Integrations", icon: Plug, adminOnly: true },
  { href: "/profile", label: "Profile", icon: User },
];

// Filter by role at both levels; drop a parent only if it's admin-only itself.
// A parent whose children are all hidden still shows (it's its own page).
export function visibleNavItems(role: string | null | undefined): NavItem[] {
  const isAdmin = role === "admin" || role === "manager";
  return NAV_ITEMS.filter((it) => !it.adminOnly || isAdmin).map((it) => ({
    ...it,
    children: it.children?.filter((c) => !c.adminOnly || isAdmin),
  }));
}
