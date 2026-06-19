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
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#111111", color: "#f5f5f5" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur"
        style={{ borderColor: "#2a2a2a", backgroundColor: "rgba(17,17,17,0.85)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/xeltrix-team-logo.png"
              alt="Xeltrix Team"
              width={38}
              height={38}
              className="rounded-xl"
            />
            <span className="text-lg font-semibold tracking-tight">Xeltrix Team</span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#b5c76a", color: "#111111" }}
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(181,199,106,0.08)" }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">

            {/* Text */}
            <div>
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
                style={{ borderColor: "rgba(181,199,106,0.35)", backgroundColor: "rgba(181,199,106,0.1)", color: "#b5c76a" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#b5c76a" }} />
                Zoho Books connected · Multi-org · Passwordless
              </div>
              <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Run your whole team{" "}
                <span style={{ color: "#b5c76a" }}>from one screen.</span>
              </h1>
              <p className="mb-8 max-w-lg text-lg leading-relaxed" style={{ color: "#999" }}>
                Attendance, tasks, field visits, expenses, leads — all in one place.
                Admins sign in with a magic link. Staff tap a PIN. Everything syncs with
                Zoho Books automatically.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-lg px-6 py-3 text-sm font-semibold transition-colors"
                  style={{ backgroundColor: "#b5c76a", color: "#111111" }}
                >
                  Sign in
                </Link>
                <a
                  href="https://wa.me/919731412112"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border px-6 py-3 text-sm font-semibold transition-colors hover:border-neutral-500"
                  style={{ borderColor: "#333", color: "#ccc" }}
                >
                  Request access →
                </a>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div
              className="rounded-2xl border p-4 shadow-2xl"
              style={{ borderColor: "#2a2a2a", backgroundColor: "#1a1a1a" }}
            >
              {/* Browser chrome */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#333" }} />
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#333" }} />
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#333" }} />
                <div className="ml-2 flex-1 rounded px-3 py-1 text-xs" style={{ backgroundColor: "#222", color: "#555" }}>
                  team.xeltrixchem.com/dashboard
                </div>
              </div>

              {/* KPI row */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Present Today", value: "12", color: "#b5c76a" },
                  { label: "Tasks Done", value: "47", color: "#7eb8d4" },
                  { label: "Pipeline", value: "₹8.2L", color: "#e8a838" },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg p-3" style={{ backgroundColor: "#222" }}>
                    <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "#666" }}>{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Attendance */}
              <div className="mb-3 rounded-lg p-3" style={{ backgroundColor: "#222" }}>
                <p className="mb-2 text-xs font-medium" style={{ color: "#777" }}>Today's Attendance</p>
                <div className="space-y-1.5">
                  {[
                    { name: "Ravi Kumar", time: "09:02 AM", status: "On time", ok: true },
                    { name: "Priya S.", time: "09:18 AM", status: "On time", ok: true },
                    { name: "Arjun M.", time: "10:05 AM", status: "Late", ok: false },
                  ].map((r) => (
                    <div key={r.name} className="flex items-center justify-between text-xs">
                      <span style={{ color: "#ccc" }}>{r.name}</span>
                      <span style={{ color: "#555" }}>{r.time}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-medium"
                        style={r.ok
                          ? { backgroundColor: "rgba(181,199,106,0.15)", color: "#b5c76a" }
                          : { backgroundColor: "rgba(232,168,56,0.15)", color: "#e8a838" }}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks */}
              <div className="rounded-lg p-3" style={{ backgroundColor: "#222" }}>
                <p className="mb-2 text-xs font-medium" style={{ color: "#777" }}>Tasks</p>
                <div className="space-y-1.5">
                  {[
                    { task: "Follow up — Mehta Industries", done: false },
                    { task: "Send Q2 expense report", done: true },
                    { task: "Update Zoho Books entries", done: false },
                  ].map((t) => (
                    <div key={t.task} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded border"
                        style={t.done
                          ? { borderColor: "#b5c76a", backgroundColor: "#b5c76a" }
                          : { borderColor: "#444" }}
                      />
                      <span style={{ color: t.done ? "#555" : "#ccc", textDecoration: t.done ? "line-through" : "none" }}>
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
      <section className="border-t px-4 py-16" style={{ borderColor: "#222", backgroundColor: "#161616" }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">
            Built for how field teams actually work.
          </h2>
          <p className="mb-12 text-center" style={{ color: "#777" }}>
            Every feature your team needs — nothing bloating the interface.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "🕐",
                title: "Attendance & comp-off",
                desc: "One-tap check-in with GPS. Tracks present, absent, WFH, half-day, and leave. Automatically credits comp-off when staff work on Sundays, first Saturdays, or holidays.",
              },
              {
                icon: "✅",
                title: "Tasks & recurring routines",
                desc: "Assign tasks with priority and due dates. Build daily, weekly, or monthly routines that auto-generate instances — no manual re-creation ever.",
              },
              {
                icon: "🗺️",
                title: "Field visit tracking",
                desc: "Log customer visits with GPS check-in and check-out. See route maps, haversine distance, time on site, and top customers visited — per person, per month.",
              },
              {
                icon: "📊",
                title: "Leads, pipeline & quotes",
                desc: "Full CRM: leads with geolocation, 6-stage opportunity pipeline, quote/estimate tracking with expiry alerts, and auto-generated follow-ups on every status change.",
              },
              {
                icon: "🔗",
                title: "Zoho Books sync",
                desc: "Two-way sync with Zoho Books — pull customers, invoices, estimates, and expenses. Push won deals as draft invoices. Employee advance reconciliation built in.",
              },
              {
                icon: "💸",
                title: "Expenses & payments",
                desc: "Submit expenses, match them to Zoho Books entries, and track recurring payments (rent, salaries, GST) with budget vs actual variance — month by month.",
              },
              {
                icon: "✉️",
                title: "Passwordless sign-in",
                desc: "Admins and managers get a magic link or 6-digit OTP by email — no passwords to remember, reset, or manage. Staff log in with a short PIN on any shared device.",
              },
              {
                icon: "🏢",
                title: "Multi-org, one login",
                desc: "One admin account can manage multiple organisations and switch between them instantly — ideal for owners running more than one business or branch.",
              },
              {
                icon: "🎯",
                title: "Targets & leaderboard",
                desc: "Set monthly sales targets per person. Track achievement % against won opportunities. Visual progress bars and a team leaderboard keep everyone accountable.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border p-6 transition-colors"
                style={{ borderColor: "#2a2a2a", backgroundColor: "#111111" }}
              >
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#777" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── More highlights strip ───────────────────────────────────── */}
      <section className="border-t px-4 py-10" style={{ borderColor: "#222" }}>
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { stat: "9+", label: "Modules in one app" },
              { stat: "Multi-org", label: "One login, many teams" },
              { stat: "Zoho Books", label: "Two-way sync" },
              { stat: "PIN + Magic link", label: "No passwords for staff" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border p-5 text-center" style={{ borderColor: "#2a2a2a", backgroundColor: "#161616" }}>
                <p className="text-xl font-bold" style={{ color: "#b5c76a" }}>{s.stat}</p>
                <p className="mt-1 text-xs" style={{ color: "#666" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section className="border-t px-4 py-16" style={{ borderColor: "#222", backgroundColor: "#161616" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <p className="mb-12 text-center" style={{ color: "#777" }}>Up and running in minutes, not weeks.</p>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Request access",
                desc: "Message us on WhatsApp. We set up your organisation, connect Zoho Books, and configure team roles.",
              },
              {
                step: "2",
                title: "Add your team",
                desc: "Invite managers by email. Give field staff a PIN. Each role sees only what it needs.",
              },
              {
                step: "3",
                title: "Run every day",
                desc: "Open the app each morning — attendance, tasks, visits, and synced financials are waiting on the dashboard.",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold"
                  style={{ borderColor: "#b5c76a", color: "#b5c76a" }}
                >
                  {s.step}
                </div>
                <h3 className="mb-2 font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#777" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ───────────────────────────────────────────── */}
      <section className="border-t px-4 py-16" style={{ borderColor: "#222" }}>
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-2xl font-bold sm:text-3xl">Built for real teams</h2>
          <p className="mb-12 text-center" style={{ color: "#777" }}>
            Not enterprise bloat — lean tools that match how small teams actually work.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                emoji: "🏪",
                title: "Retail & distribution",
                desc: "Track shop-floor attendance, assign replenishment tasks, follow up on wholesale leads, and reconcile expenses — all in one tab.",
              },
              {
                emoji: "🏭",
                title: "Small businesses",
                desc: "Replace WhatsApp groups and paper registers. Every team member knows their tasks; every manager sees the full picture.",
              },
              {
                emoji: "🚗",
                title: "Field sales teams",
                desc: "Log GPS visits, update pipeline on the road, and let Zoho Books sync handle the accounting entries automatically.",
              },
            ].map((w) => (
              <div
                key={w.title}
                className="rounded-xl border p-6"
                style={{ borderColor: "#2a2a2a", backgroundColor: "#161616" }}
              >
                <div className="mb-3 text-4xl">{w.emoji}</div>
                <h3 className="mb-2 font-semibold">{w.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#777" }}>{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="border-t px-4 py-20 text-center" style={{ borderColor: "#222", backgroundColor: "#161616" }}>
        <div className="mx-auto max-w-xl">
          <Image
            src="/xeltrix-team-logo.png"
            alt="Xeltrix Team"
            width={64}
            height={64}
            className="mx-auto mb-6 rounded-2xl"
          />
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Ready to run your team from one screen?
          </h2>
          <p className="mb-8" style={{ color: "#777" }}>
            Message us on WhatsApp — we'll have your team set up, usually the same day.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="https://wa.me/919731412112"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-lg px-8 py-3.5 text-sm font-semibold transition-colors sm:w-auto"
              style={{ backgroundColor: "#b5c76a", color: "#111111" }}
            >
              Request access on WhatsApp
            </a>
            <Link
              href="/login"
              className="w-full rounded-lg border px-8 py-3.5 text-sm font-semibold transition-colors sm:w-auto"
              style={{ borderColor: "#333", color: "#ccc" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t px-4 py-8" style={{ borderColor: "#222" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/xeltrix-team-logo.png" alt="Xeltrix Team" width={22} height={22} className="rounded" />
            <span className="text-sm" style={{ color: "#555" }}>
              © {new Date().getFullYear()} Xeltrix Chemicals Private Limited
            </span>
          </div>
          <div className="flex gap-6 text-sm" style={{ color: "#555" }}>
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
            <a
              href="https://wa.me/919731412112"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
