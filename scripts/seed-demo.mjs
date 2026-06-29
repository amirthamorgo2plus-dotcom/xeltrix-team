/**
 * Seed (or re-seed) the public read-only demo org for Xeltrix Team.
 *
 * Creates the demo admin account (auto-signed-in by the homepage "View Demo"
 * button), ~12 fake staff, and realistic data across every main module so a
 * visitor lands on a fully-alive dashboard. Idempotent: re-running wipes the
 * demo org's data and reseeds. Uses the service-role key (bypasses RLS and the
 * read-only triggers, since service-role has no auth.uid()).
 *
 * Run once (after applying migration 00031):
 *   node scripts/seed-demo.mjs
 *
 * Requires in env (or .env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// supabase-js constructs a realtime client (needs a global WebSocket) even
// though this script only uses auth + REST. Node < 22 has no global WebSocket,
// so provide a stub — it's never actually connected (we don't subscribe).
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {
    constructor() {
      throw new Error("realtime not used in seed");
    }
  };
}

// ── env (process.env first, then .env.local) ──────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  try {
    const txt = readFileSync(join(here, "..", ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env.local — rely on process.env */
  }
}
loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!URL || !KEY || !DEMO_PASSWORD) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD."
  );
  process.exit(1);
}

// Keep in sync with src/lib/demo.ts
const DEMO_TEAM_ID = "00000000-0000-0000-0000-0000000d3110";
const DEMO_TEAM_NAME = "Xeltrix Team — Demo";
const DEMO_EMAIL = "demo@xeltrixchem.com";
const STAFF_DOMAIN = "demo.local";

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ── helpers ───────────────────────────────────────────────────────────────
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const ymd = (d) => d.toISOString().slice(0, 10);
const atTime = (d, h, m) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};
const pick = (arr, i) => arr[i % arr.length];

async function findUserByEmail(email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === target);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ensureUser(email, fullName, password) {
  const existing = await findUserByEmail(email);
  if (existing) {
    // keep the password fresh so login keeps working
    await sb.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { full_name: fullName },
    });
    return existing.id;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data?.user) throw new Error(`createUser ${email}: ${error?.message}`);
  return data.user.id;
}

async function ins(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await sb.from(table).insert(rows).select("id");
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return data ?? [];
}

// ── the team roster ─────────────────────────────────────────────────────────
const STAFF = [
  ["Ravi Kumar", "manager"],
  ["Priya Sundaram", "manager"],
  ["Arjun Murugan", "member"],
  ["Deepa Raman", "member"],
  ["Karthik Nair", "member"],
  ["Lakshmi Iyer", "member"],
  ["Suresh Babu", "member"],
  ["Anitha Devi", "member"],
  ["Vimal Raj", "member"],
  ["Meena Krishnan", "member"],
  ["Gopal Venkat", "member"],
  ["Divya Mohan", "member"],
];

async function main() {
  console.log("Seeding demo org…");

  // 1. demo team + settings
  await sb.from("teams").upsert({ id: DEMO_TEAM_ID, name: DEMO_TEAM_NAME }).throwOnError();
  await sb
    .from("team_settings")
    .upsert({
      team_id: DEMO_TEAM_ID,
      config: {
        currency: "INR",
        full_day_hours: 8,
        half_day_hours: 4,
        weekly_off: [0, "1st_saturday"],
        target_cadence: "monthly",
      },
    })
    .throwOnError();

  // 2. demo admin (the auto-login account) — read-only
  const adminUserId = await ensureUser(DEMO_EMAIL, "Demo Admin", DEMO_PASSWORD);

  // 3. staff users
  const staff = [];
  for (const [name, role] of STAFF) {
    const email = `${slug(name)}@${STAFF_DOMAIN}`;
    const id = await ensureUser(email, name, "demo-" + slug(name) + "-pw");
    staff.push({ name, role, userId: id });
  }

  // 4. memberships (everyone read-only)
  const members = [
    { user_id: adminUserId, role: "admin", name: "Demo Admin" },
    ...staff.map((s) => ({ user_id: s.userId, role: s.role, name: s.name })),
  ];
  await sb
    .from("team_members")
    .upsert(
      members.map((m) => ({
        team_id: DEMO_TEAM_ID,
        user_id: m.user_id,
        role: m.role,
        active: true,
        track_attendance: true,
        attendance_only: false,
        read_only: true,
      })),
      { onConflict: "team_id,user_id" }
    )
    .throwOnError();

  // map user_id → team_members.id
  const { data: tmRows } = await sb
    .from("team_members")
    .select("id, user_id")
    .eq("team_id", DEMO_TEAM_ID);
  const memberIdByUser = new Map((tmRows ?? []).map((r) => [r.user_id, r.id]));
  const staffMemberIds = staff.map((s) => memberIdByUser.get(s.userId));
  const adminMemberId = memberIdByUser.get(adminUserId);
  const allMemberIds = [adminMemberId, ...staffMemberIds];

  // 5. wipe previous demo data (idempotent reseed)
  console.log("Clearing previous demo data…");
  for (const t of [
    "visits",
    "follow_ups",
    "opportunities",
    "complaints",
    "tasks",
    "expense_submissions",
    "expense_payments",
    "expense_items",
    "targets",
    "leads",
  ]) {
    if (t === "targets") {
      await sb.from(t).delete().in("member_id", allMemberIds);
    } else {
      await sb.from(t).delete().eq("team_id", DEMO_TEAM_ID);
    }
  }
  await sb.from("attendance").delete().in("member_id", allMemberIds);

  // 6. attendance — last 7 days; today all present except 1 leave + 1 half_day
  console.log("Attendance…");
  const attendance = [];
  for (let d = 0; d < 7; d++) {
    const date = daysAgo(d);
    const dow = date.getDay();
    if (dow === 0) continue; // Sunday off
    staffMemberIds.forEach((mid, i) => {
      let status = "present";
      let inH = 9,
        inM = i % 5 === 0 ? 18 : 2; // a few clock in late-ish
      let hours = 8.5;
      if (d === 0 && i === STAFF.length - 1) {
        status = "leave";
        hours = 0;
      } else if (d === 0 && i === STAFF.length - 2) {
        status = "half_day";
        hours = 4;
      }
      const row = {
        member_id: mid,
        date: ymd(date),
        status,
        hours: status === "leave" ? null : hours,
      };
      if (status !== "leave") {
        row.check_in_at = atTime(date, inH, inM);
        row.check_out_at = atTime(date, status === "half_day" ? 13 : 18, 15);
      }
      attendance.push(row);
    });
  }
  await ins("attendance", attendance);

  // 7. leads (with address for the map)
  console.log("Leads…");
  const leadDefs = [
    ["Mehta Industries", "new", "Website", "Avinashi Rd, Coimbatore, Tamil Nadu 641018", 11.0168, 76.9558],
    ["Sri Lakshmi Textiles", "contacted", "Referral", "Tiruppur, Tamil Nadu 641604", 11.1085, 77.3411],
    ["Green Valley Resorts", "qualified", "WhatsApp", "Ooty, Tamil Nadu 643001", 11.4102, 76.695],
    ["Coimbatore Hospitals Ltd", "qualified", "Cold call", "Race Course, Coimbatore 641018", 11.0, 76.9667],
    ["Anbu Traders", "new", "JustDial", "Gandhipuram, Coimbatore 641012", 11.0183, 76.9725],
    ["Royal Spinning Mills", "contacted", "Website", "Karur, Tamil Nadu 639001", 10.9601, 78.0766],
    ["Velan Hotels", "converted", "Referral", "RS Puram, Coimbatore 641002", 11.0064, 76.9486],
    ["Sakthi Auto", "lost", "Cold call", "Salem, Tamil Nadu 636001", 11.6643, 78.146],
    ["Annapoorna Foods", "qualified", "WhatsApp", "Town Hall, Coimbatore 641001", 11.0023, 76.9659],
    ["KMCH Pharmacy", "contacted", "Website", "Avinashi Rd, Coimbatore 641014", 11.0299, 77.0],
    ["Sri Balaji Stores", "new", "JustDial", "Pollachi, Tamil Nadu 642001", 10.6588, 77.0085],
    ["Nilgiri Tea Estates", "qualified", "Referral", "Coonoor, Tamil Nadu 643101", 11.3531, 76.7959],
  ];
  const leadRows = leadDefs.map((l, i) => ({
    team_id: DEMO_TEAM_ID,
    owner_id: pick(staffMemberIds, i),
    name: l[0],
    phone: "+9198" + (40000000 + i * 111111),
    source: l[2],
    status: l[1],
    address: l[3],
    latitude: l[4],
    longitude: l[5],
    geocode_status: "ok",
    geocoded_at: new Date().toISOString(),
  }));
  const leadIds = (await ins("leads", leadRows)).map((r) => r.id);

  // 8. opportunities (pipeline) + a couple won/collections
  console.log("Opportunities…");
  const oppDefs = [
    ["Mehta Industries — annual contract", 250000, "proposal", 60, 0],
    ["Sri Lakshmi Textiles — bulk order", 180000, "negotiation", 75, 1],
    ["Green Valley Resorts — housekeeping", 150000, "qualification", 40, 2],
    ["Coimbatore Hospitals — sanitation", 120000, "proposal", 55, 3],
    ["Annapoorna Foods — monthly supply", 120000, "prospecting", 20, 8],
    ["Velan Hotels — Q2 renewal", 95000, "won", 100, 6],
    ["Nilgiri Tea Estates — pilot", 60000, "won", 100, 11],
  ];
  const oppRows = oppDefs.map((o, i) => {
    const won = o[2] === "won";
    return {
      team_id: DEMO_TEAM_ID,
      lead_id: leadIds[o[4]] ?? null,
      owner_id: pick(staffMemberIds, i),
      title: o[0],
      value: o[1],
      stage: o[2],
      probability: o[3],
      close_date: ymd(won ? daysAgo(5) : daysAgo(-20)),
      balance_due: won ? o[1] * 0.5 : null,
      due_date: won ? ymd(daysAgo(-10)) : null,
      invoice_status: won ? "partially_paid" : null,
    };
  });
  await ins("opportunities", oppRows);

  // 9. tasks — ~50 with most done this month
  console.log("Tasks…");
  const taskTitles = [
    "Follow up — Mehta Industries",
    "Send Q2 expense report",
    "Update Zoho Books entries",
    "Call Sri Lakshmi Textiles",
    "Prepare quote for Green Valley",
    "Site visit — Coimbatore Hospitals",
    "Collect payment — Velan Hotels",
    "Restock sample kits",
    "Renew JustDial listing",
    "Reconcile employee advances",
  ];
  const taskRows = [];
  for (let i = 0; i < 52; i++) {
    const done = i < 47;
    const created = daysAgo(20 - (i % 18));
    taskRows.push({
      team_id: DEMO_TEAM_ID,
      owner_id: pick(allMemberIds, i),
      title: `${pick(taskTitles, i)}${i >= taskTitles.length ? " #" + (i + 1) : ""}`,
      priority: pick(["low", "medium", "high", "urgent"], i),
      status: done ? "done" : pick(["todo", "in_progress"], i),
      due_at: atTime(daysAgo(done ? 1 + (i % 5) : -(1 + (i % 5))), 17, 0),
      created_at: created.toISOString(),
      updated_at: (done ? daysAgo(i % 6) : created).toISOString(),
    });
  }
  await ins("tasks", taskRows);

  // 10. follow-ups (a couple overdue, a couple upcoming)
  console.log("Follow-ups…");
  await ins(
    "follow_ups",
    [
      [0, -1, "call", "Discuss annual contract terms"],
      [1, 1, "whatsapp", "Share revised pricing"],
      [3, 2, "call", "Confirm site visit slot"],
      [8, -2, "email", "Send product catalogue"],
      [9, 3, "call", "Check sample feedback"],
    ].map(([li, due, channel, notes], i) => ({
      team_id: DEMO_TEAM_ID,
      lead_id: leadIds[li],
      owner_id: pick(staffMemberIds, i),
      due_at: atTime(daysAgo(-due), 11, 30),
      channel,
      notes,
    }))
  );

  // 11. complaints
  console.log("Complaints…");
  await ins("complaints", [
    {
      team_id: DEMO_TEAM_ID,
      customer_name: "Velan Hotels",
      owner_id: staffMemberIds[0],
      subject: "Late delivery of cleaning supplies",
      description: "Order #4521 arrived two days late.",
      severity: "medium",
      status: "in_progress",
    },
    {
      team_id: DEMO_TEAM_ID,
      customer_name: "Annapoorna Foods",
      owner_id: staffMemberIds[1],
      subject: "Invoice mismatch",
      description: "GST amount differs from quote.",
      severity: "low",
      status: "open",
    },
    {
      team_id: DEMO_TEAM_ID,
      customer_name: "KMCH Pharmacy",
      owner_id: staffMemberIds[2],
      subject: "Damaged carton",
      description: "One carton damaged in transit; replacement sent.",
      severity: "high",
      status: "resolved",
      resolved_at: daysAgo(3).toISOString(),
    },
  ]);

  // 12. targets — current month per staff member
  console.log("Targets…");
  const monthStart = new Date();
  monthStart.setDate(1);
  await ins(
    "targets",
    staffMemberIds.map((mid, i) => ({
      member_id: mid,
      month: ymd(monthStart),
      amount: 100000 + (i % 4) * 25000,
    }))
  );

  // 13. visits (field check-ins)
  console.log("Visits…");
  await ins(
    "visits",
    [0, 2, 3, 8].map((li, i) => ({
      team_id: DEMO_TEAM_ID,
      member_id: pick(staffMemberIds, i),
      lead_id: leadIds[li],
      check_in_at: atTime(daysAgo(i), 10, 15),
      check_in_lat: leadRows[li].latitude,
      check_in_lng: leadRows[li].longitude,
      check_out_at: atTime(daysAgo(i), 11, 5),
      check_out_lat: leadRows[li].latitude,
      check_out_lng: leadRows[li].longitude,
      notes: "Product demo and pricing discussion.",
    }))
  );

  // 14. recurring expenses + this-month payments
  console.log("Expenses…");
  const itemDefs = [
    ["Office Rent", "Rent", "Monthly", 45000, 5],
    ["Staff Salaries", "Payroll", "Monthly", 280000, 1],
    ["GST Payment", "Tax", "Monthly", 60000, 20],
    ["Internet & Phone", "Utilities", "Monthly", 4500, 10],
    ["Vehicle Fuel", "Logistics", "Monthly", 18000, 1],
  ];
  const itemIds = (
    await ins(
      "expense_items",
      itemDefs.map((it, i) => ({
        team_id: DEMO_TEAM_ID,
        name: it[0],
        category: it[1],
        frequency: it[2],
        budget: it[3],
        due_day: it[4],
        sort_order: i,
      }))
    )
  ).map((r) => r.id);
  await ins(
    "expense_payments",
    itemIds.slice(0, 4).map((id, i) => ({
      team_id: DEMO_TEAM_ID,
      item_id: id,
      month: ymd(monthStart),
      actual: itemDefs[i][3] * (0.95 + (i % 3) * 0.03),
      paid_on: ymd(daysAgo(2)),
      paid_by: adminMemberId,
    }))
  );

  // 15. employee expense submissions
  console.log("Expense submissions…");
  await ins(
    "expense_submissions",
    [
      ["Client lunch — Mehta Industries", 1850, "Meals", "verified"],
      ["Fuel for site visits", 2400, "Travel", "pending"],
      ["Printing brochures", 1200, "Marketing", "pending"],
      ["Courier charges", 650, "Logistics", "verified"],
      ["Sample kit refill", 3100, "Supplies", "rejected"],
    ].map(([desc, amount, category, status], i) => ({
      team_id: DEMO_TEAM_ID,
      member_id: pick(staffMemberIds, i),
      date: ymd(daysAgo(i + 1)),
      description: desc,
      amount,
      category,
      status,
      verified_at: status === "verified" ? daysAgo(i).toISOString() : null,
      verified_by: status === "verified" ? adminMemberId : null,
      reject_reason: status === "rejected" ? "No receipt attached." : null,
    }))
  );

  console.log("\n✅ Demo seeded.");
  console.log(`   Org:   ${DEMO_TEAM_NAME} (${DEMO_TEAM_ID})`);
  console.log(`   Admin: ${DEMO_EMAIL}`);
  console.log(`   Staff: ${STAFF.length} members`);
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e.message);
  process.exit(1);
});
