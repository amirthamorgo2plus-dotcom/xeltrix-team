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
  Users2,
  Plug,
  Package,
  TrendingUp,
  FileText,
  UserCog,
  Wallet,
  Receipt,
  MapPin,
  QrCode,
  BadgeIndianRupee,
  UserPlus,
  HandCoins,
  ListChecks,
  Calculator,
  HelpCircle,
  Sparkles,
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

// Ordered by who opens what, and how often.
//
// Tasks, Attendance and Visits are what a field member opens every day, so
// they sit above the customer stack rather than below it. Admin-only groups
// are filtered out entirely for a member, so putting them lower costs an
// admin one scroll and saves everyone else a hunt.
//
// A parent is always a real page as well as a group header, so a child only
// belongs here if its parent is genuinely the page it lives under.
export const NAV_ITEMS: NavItem[] = [
  { href: "/hub", label: "Command Center", icon: LayoutGrid },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },

  // ---- Daily work ----
  {
    href: "/tasks",
    label: "Tasks",
    icon: CheckSquare,
    children: [
      { href: "/tasks/report", label: "Pending report", icon: ClipboardList },
      { href: "/tasks/routines", label: "Routines", icon: Repeat, adminOnly: true },
    ],
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: Clock,
    children: [
      { href: "/attendance/summary", label: "Summary", icon: ClipboardList },
      { href: "/attendance/leave", label: "Leave & year", icon: CalendarDays },
      { href: "/holidays", label: "Holidays", icon: CalendarHeart },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  { href: "/visits", label: "Visits", icon: MapPin },

  // ---- Selling ----
  {
    href: "/leads",
    label: "Customers",
    icon: Users,
    children: [
      { href: "/opportunities",      label: "Pipeline",           icon: Briefcase },
      { href: "/quotes",             label: "Quotes",             icon: FileText },
      { href: "/follow-ups",         label: "Follow-ups",         icon: Bell },
      { href: "/complaints",         label: "Complaints",         icon: AlertCircle },
      { href: "/repeat-customers",   label: "Repeat Customers",   icon: Repeat },
      { href: "/referrers",          label: "Referrers",          icon: HandCoins },
      { href: "/referral-customers", label: "Referral Customers", icon: UserPlus },
    ],
  },

  // ---- Deep cleaning: its own business line, with its own pipeline ----
  {
    href: "/deep-cleaning",
    label: "Deep Cleaning",
    icon: Sparkles,
    children: [
      { href: "/deep-cleaning/calendar", label: "Schedule", icon: CalendarDays },
    ],
  },

  // ---- Money in ----
  { href: "/collections", label: "Collections", icon: BadgeIndianRupee },
  { href: "/payment-qr", label: "Payment QR", icon: QrCode },

  // ---- Pricing ----
  {
    href: "/templates",
    label: "Product price list",
    icon: Package,
    children: [
      { href: "/price-lists", label: "Customer Price Lists", icon: ListChecks, adminOnly: true },
      { href: "/margin-calculator", label: "Margin Calculator", icon: Calculator },
    ],
  },

  // ---- Performance ----
  {
    href: "/targets",
    label: "Targets",
    icon: Target,
    children: [
      { href: "/salespersons", label: "Salesperson performance", icon: UserCog },
    ],
  },

  // ---- Admin ----
  { href: "/profitability", label: "Profitability", icon: TrendingUp, adminOnly: true },
  {
    href: "/expenses",
    label: "Expenses",
    icon: Receipt,
    adminOnly: true,
    children: [
      { href: "/payments", label: "Payments", icon: Wallet, adminOnly: true },
    ],
  },
  { href: "/team", label: "Team members", icon: Users2, adminOnly: true },
  { href: "/integrations", label: "Integrations", icon: Plug, adminOnly: true },

  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/profile", label: "Profile", icon: User },
];

// The only item an attendance-only staff login may see.
const ATTENDANCE_ONLY_ITEM: NavItem = {
  href: "/attendance",
  label: "Attendance",
  icon: Clock,
};

// Filter by role at both levels; drop a parent only if it's admin-only itself.
// A parent whose children are all hidden still shows (it's its own page).
export function visibleNavItems(
  role: string | null | undefined,
  attendanceOnly = false
): NavItem[] {
  if (attendanceOnly) return [ATTENDANCE_ONLY_ITEM];
  const isAdmin = role === "admin" || role === "manager";
  return NAV_ITEMS.filter((it) => !it.adminOnly || isAdmin).map((it) => ({
    ...it,
    children: it.children?.filter((c) => !c.adminOnly || isAdmin),
  }));
}
