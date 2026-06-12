// Xeltrix command-center links.
//
// Links shown on /hub are stored in the database (team_settings.config.hub_links)
// and edited by an admin in the UI (Profile page → "Command Center links"). The
// list below is only the DEFAULT/seed used when an admin hasn't saved any yet.
//
//   url      where the "Open" button goes (opens in a new tab)
//   check    true  -> /hub pings the URL server-side and shows a green/red dot
//            false -> no live status (use for third-party sites that block bots,
//                     e.g. JustDial/YouTube, so they don't show a false "down")
//   internal true  -> it's a page inside THIS app (opens in the same tab)
//
// Anything left as "#" is a placeholder — set the real URL from the UI.

export type HubLink = {
  key: string;
  name: string;
  description: string;
  url: string;
  category: HubCategory;
  emoji: string;
  // Optional logo image URL. When set, the card shows this image instead of the
  // emoji. Paste any image URL (e.g. a logo hosted anywhere, or a Supabase
  // public storage URL).
  image?: string;
  check?: boolean;
  internal?: boolean;
};

export type HubCategory = "Web presence" | "Communication" | "Business tools" | "My apps";

export const HUB_CATEGORIES: HubCategory[] = [
  "Web presence",
  "Communication",
  "Business tools",
  "My apps",
];

export const DEFAULT_HUB_LINKS: HubLink[] = [
  // ---- Web presence ----
  {
    key: "website",
    name: "Xeltrix Website",
    description: "xeltrixchem.com — public company site",
    url: "https://xeltrixchem.com",
    category: "Web presence",
    emoji: "🌐",
    check: true,
  },
  {
    key: "justdial",
    name: "JustDial",
    description: "Business listing & enquiries",
    url: "#", // TODO: paste your JustDial listing URL
    category: "Web presence",
    emoji: "📒",
  },
  {
    key: "youtube",
    name: "YouTube",
    description: "Xeltrix channel",
    url: "#", // TODO: paste your YouTube channel URL
    category: "Web presence",
    emoji: "▶️",
  },
  {
    key: "google-analytics",
    name: "Google Analytics",
    description: "Website traffic & visitors",
    url: "https://analytics.google.com",
    category: "Web presence",
    emoji: "📈",
  },

  // ---- Business tools ----
  {
    key: "zoho",
    name: "Zoho Books",
    description: "Invoices, estimates, expenses (India)",
    url: "https://books.zoho.in",
    category: "Business tools",
    emoji: "📊",
  },

  // ---- My apps ----
  {
    key: "team-app",
    name: "Team App",
    description: "This app — CRM, tasks, attendance, visits",
    url: "/dashboard",
    category: "My apps",
    emoji: "🏢",
    internal: true,
  },
  {
    key: "xeltrix-sparkle",
    name: "Xeltrix Sparkle",
    description: "Sparkle app",
    url: "#", // TODO: paste the live URL (or set it from admin settings)
    category: "My apps",
    emoji: "✨",
    check: true,
  },
  {
    key: "kamma-app",
    name: "Kamma App",
    description: "Kamma app",
    url: "#", // TODO: paste the live URL (or set it from admin settings)
    category: "My apps",
    emoji: "📱",
    check: true,
  },
  {
    key: "housekeeping-app",
    name: "Housekeeping App",
    description: "Housekeeping management",
    url: "#", // TODO: paste the live URL (or set it from admin settings)
    category: "My apps",
    emoji: "🧹",
    check: true,
  },
  {
    key: "medi-track-app",
    name: "Medi Track App",
    description: "Medical records / tracking",
    url: "#", // TODO: paste the live URL (or set it from admin settings)
    category: "My apps",
    emoji: "🩺",
    check: true,
  },
  // Add more of your own apps from Profile → Command Center links (admin).
];

const ALLOWED_CATEGORIES = new Set<string>(HUB_CATEGORIES);

// Coerce whatever is stored in team_settings.config.hub_links into a clean
// HubLink[]. Tolerant of partial/old rows so a bad save can't break /hub.
// Returns null if the value isn't a usable array (caller falls back to defaults).
export function normalizeHubLinks(raw: unknown): HubLink[] | null {
  if (!Array.isArray(raw)) return null;
  const out: HubLink[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const url = typeof o.url === "string" && o.url.trim() ? o.url.trim() : "#";
    if (!name) return;
    const category = (typeof o.category === "string" && ALLOWED_CATEGORIES.has(o.category)
      ? o.category
      : "My apps") as HubCategory;
    out.push({
      key: typeof o.key === "string" && o.key ? o.key : `link-${i}`,
      name,
      description: typeof o.description === "string" ? o.description : "",
      url,
      category,
      emoji: typeof o.emoji === "string" && o.emoji ? o.emoji : "🔗",
      image: typeof o.image === "string" && o.image.trim() ? o.image.trim() : undefined,
      check: o.check === true,
      internal: o.internal === true,
    });
  });
  return out;
}
