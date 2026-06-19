import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Xeltrix Team — Run Your Team from One Screen",
  description:
    "Attendance, tasks, daily workflows, passwordless sign-in, staff PINs, and Zoho CRM sync — everything your team needs in one place.",
  manifest: "/manifest.webmanifest",
  applicationName: "Xeltrix Team",
  keywords: ["team management", "attendance", "tasks", "Zoho CRM", "staff management", "small business"],
  openGraph: {
    title: "Xeltrix Team — Run Your Team from One Screen",
    description:
      "Attendance, tasks, daily workflows, passwordless sign-in, staff PINs, and Zoho CRM sync — everything your team needs in one place.",
    type: "website",
    siteName: "Xeltrix Team",
  },
  appleWebApp: {
    capable: true,
    title: "Xeltrix",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
