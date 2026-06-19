import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/molec.png" alt="Xeltrix" width={36} height={36} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight">Xeltrix Team</span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28">
        {/* subtle glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Text */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Zoho-connected · No passwords for admins
              </div>
              <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Run your whole team{" "}
                <span className="text-emerald-400">from one screen.</span>
              </h1>
              <p className="mb-8 max-w-lg text-lg leading-relaxed text-zinc-400">
                Attendance, tasks, daily workflows — all connected. Admins sign in with a magic link. Staff tap a PIN. And everything syncs with Zoho CRM automatically.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
                >
                  Sign in
                </Link>
                <a
                  href="https://wa.me/919731412112"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                >
                  Request access →
                </a>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
              {/* Mockup header bar */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-zinc-700" />
                <div className="h-3 w-3 rounded-full bg-zinc-700" />
                <div className="h-3 w-3 rounded-full bg-zinc-700" />
                <div className="ml-2 flex-1 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-500">
                  team.xeltrixchem.com/dashboard
                </div>
              </div>
              {/* KPI row */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Present Today", value: "12", color: "text-emerald-400" },
                  { label: "Tasks Done", value: "47", color: "text-blue-400" },
                  { label: "Open Leads", value: "8", color: "text-amber-400" },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg bg-zinc-800 p-3">
                    <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{k.label}</p>
                  </div>
                ))}
              </div>
              {/* Attendance list */}
              <div className="rounded-lg bg-zinc-800 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-400">Today's Attendance</p>
                <div className="space-y-1.5">
                  {[
                    { name: "Ravi Kumar", time: "09:02 AM", status: "On time" },
                    { name: "Priya S.", time: "09:18 AM", status: "On time" },
                    { name: "Arjun M.", time: "10:05 AM", status: "Late" },
                  ].map((r) => (
                    <div key={r.name} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{r.name}</span>
                      <span className="text-zinc-500">{r.time}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          r.status === "Late"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-emerald-500/15 text-emerald-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Task row */}
              <div className="mt-3 rounded-lg bg-zinc-800 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-400">Pending Tasks</p>
                <div className="space-y-1.5">
                  {[
                    { task: "Follow up — Mehta Industries", done: false },
                    { task: "Send Q2 report to accounts", done: true },
                    { task: "Update product price list", done: false },
                  ].map((t) => (
                    <div key={t.task} className="flex items-center gap-2 text-xs">
                      <span
                        className={`h-3.5 w-3.5 shrink-0 rounded border ${
                          t.done
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-zinc-600"
                        }`}
                      />
                      <span className={t.done ? "text-zinc-500 line-through" : "text-zinc-300"}>
                        {t.task}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Grid ───────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 bg-zinc-900 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">
            Everything your team needs, nothing it doesn't.
          </h2>
          <p className="mb-12 text-center text-zinc-400">Six core pillars, all in one app.</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "🕐",
                title: "Attendance tracking",
                desc: "One-tap check-in and check-out. Late arrivals, absences, and holiday calendars handled automatically.",
              },
              {
                icon: "✅",
                title: "Tasks & workflows",
                desc: "Assign tasks, set deadlines, and build daily routine checklists that repeat without manual setup.",
              },
              {
                icon: "✉️",
                title: "Passwordless email sign-in",
                desc: "Admins and managers receive a one-time code or magic link — no passwords to remember or reset.",
              },
              {
                icon: "🔢",
                title: "Staff PIN login",
                desc: "Field staff and shop floor workers log in with a short PIN on any shared device — fast and frictionless.",
              },
              {
                icon: "🔗",
                title: "Zoho CRM integration",
                desc: "Leads, contacts, and deals sync automatically between Xeltrix Team and your Zoho CRM instance.",
              },
              {
                icon: "📊",
                title: "Reports & exports",
                desc: "Daily attendance summaries, task completion rates, and sales reports ready to download as CSV or PDF.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="mb-2 font-semibold text-zinc-100">{f.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <p className="mb-12 text-center text-zinc-400">Up and running in minutes, not weeks.</p>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Request access",
                desc: "Message us on WhatsApp and we'll set up your organisation, team roles, and Zoho connection.",
              },
              {
                step: "2",
                title: "Add your team",
                desc: "Invite managers by email. Staff get a PIN. Everyone sees only what their role allows.",
              },
              {
                step: "3",
                title: "Run every day",
                desc: "Open the app each morning — attendance, tasks, and synced leads are waiting on the dashboard.",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-500 text-lg font-bold text-emerald-400">
                  {s.step}
                </div>
                <h3 className="mb-2 font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ───────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 bg-zinc-900 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">Built for real teams</h2>
          <p className="mb-12 text-center text-zinc-400">
            Not enterprise bloat — lean tools that match how small teams actually work.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                emoji: "🏪",
                title: "Retail & distribution",
                desc: "Track shop-floor staff attendance, assign replenishment tasks, and follow up on wholesale leads — all in one tab.",
              },
              {
                emoji: "🏭",
                title: "Small businesses",
                desc: "Replace WhatsApp groups and paper registers. Every team member knows their tasks; every manager sees the full picture.",
              },
              {
                emoji: "🚗",
                title: "Field sales teams",
                desc: "Log visits, update lead status on the road, and let Zoho sync handle the data entry automatically.",
              },
            ].map((w) => (
              <div key={w.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
                <div className="mb-3 text-4xl">{w.emoji}</div>
                <h3 className="mb-2 font-semibold">{w.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="border-t border-zinc-800 px-4 py-20 text-center">
        <div className="mx-auto max-w-xl">
          <Image
            src="/molec.png"
            alt="Xeltrix"
            width={56}
            height={56}
            className="mx-auto mb-6 rounded-xl"
          />
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Ready to run your team from one screen?
          </h2>
          <p className="mb-8 text-zinc-400">
            Message us on WhatsApp and we'll get your team set up — usually within the same day.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="https://wa.me/919731412112"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-lg bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors sm:w-auto"
            >
              Request access on WhatsApp
            </a>
            <Link
              href="/login"
              className="w-full rounded-lg border border-zinc-700 px-8 py-3.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/molec.png" alt="Xeltrix" width={24} height={24} className="rounded" />
            <span className="text-sm text-zinc-400">
              © {new Date().getFullYear()} Xeltrix Chemicals Private Limited
            </span>
          </div>
          <div className="flex gap-6 text-sm text-zinc-500">
            <Link href="/login" className="hover:text-zinc-300 transition-colors">
              Sign in
            </Link>
            <a
              href="https://wa.me/919731412112"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
