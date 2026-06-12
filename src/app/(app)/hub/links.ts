// Xeltrix command-center links.
//
// This is the ONE place to edit what shows on /hub. Add, remove, or re-URL a
// card by editing this list — no other file needs to change.
//
//   url      where the "Open" button goes (opens in a new tab)
//   check    true  -> /hub pings the URL server-side and shows a green/red dot
//            false -> no live status (use for third-party sites that block bots,
//                     e.g. JustDial/YouTube, so they don't show a false "down")
//   internal true  -> it's a page inside THIS app (opens in the same tab)
//
// Anything left as "#" is a placeholder — paste the real URL when you have it.

export type HubLink = {
  key: string;
  name: string;
  description: string;
  url: string;
  category: HubCategory;
  emoji: string;
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

export const HUB_LINKS: HubLink[] = [
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

  // ---- Communication ----
  {
    key: "email",
    name: "Email (Resend)",
    description: "noreply@xeltrixchem.com — delivery logs",
    url: "https://resend.com/emails",
    category: "Communication",
    emoji: "✉️",
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
  // Add more of your own apps here, e.g.:
  // {
  //   key: "options-trading",
  //   name: "Options Trading",
  //   description: "Copy-trading platform",
  //   url: "https://...",
  //   category: "My apps",
  //   emoji: "📈",
  //   check: true,
  // },
];
