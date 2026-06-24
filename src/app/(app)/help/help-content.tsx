"use client";

import { useState } from "react";

type Step = { en: string; ta: string };
type Section = {
  id: string;
  group: string;
  title_en: string;
  title_ta: string;
  intro_en: string;
  intro_ta: string;
  steps: Step[];
  tip?: { en: string; ta: string };
};

const GROUPS: { key: string; en: string; ta: string }[] = [
  { key: "start", en: "Getting Started", ta: "தொடங்குதல்" },
  { key: "attendance", en: "Attendance & Calendar", ta: "வருகை & நாட்காட்டி" },
  { key: "sales", en: "Leads & Sales", ta: "லீட்ஸ் & விற்பனை" },
  { key: "money", en: "Money & Targets", ta: "பணம் & இலக்குகள்" },
  { key: "pricing", en: "Products & Pricing", ta: "பொருட்கள் & விலை" },
  { key: "referral", en: "Referrals & Commission", ta: "அறிமுகம் & கமிஷன்" },
  { key: "tasks", en: "Tasks", ta: "பணிகள்" },
  { key: "admin", en: "Admin (Managers)", ta: "நிர்வாகம் (மேலாளர்கள்)" },
];

const SECTIONS: Section[] = [
  // ---------- Getting Started ----------
  {
    id: "hub", group: "start",
    title_en: "Command Center & Dashboard", title_ta: "கட்டளை மையம் & டாஷ்போர்டு",
    intro_en: "Your home screen — quick links and a summary of your day.",
    intro_ta: "உங்கள் முகப்புத் திரை — விரைவு இணைப்புகள் & இன்றைய சுருக்கம்.",
    steps: [
      { en: "Command Center has shortcut tiles to the tools you use most.", ta: "Command Center-ல் நீங்கள் அதிகம் பயன்படுத்தும் கருவிகளுக்கான குறுக்குவழிகள் உள்ளன." },
      { en: "Dashboard shows open leads, your role, and key numbers at a glance.", ta: "Dashboard திறந்த லீட்ஸ், உங்கள் பங்கு, முக்கிய எண்களைக் காண்பிக்கும்." },
    ],
  },
  {
    id: "profile", group: "start",
    title_en: "Profile", title_ta: "சுயவிவரம்",
    intro_en: "Your account details.",
    intro_ta: "உங்கள் கணக்கு விவரங்கள்.",
    steps: [
      { en: "Update your name, phone, and photo.", ta: "உங்கள் பெயர், தொலைபேசி, புகைப்படத்தைப் புதுப்பிக்கவும்." },
      { en: "Switch organisation here if you belong to more than one.", ta: "ஒன்றுக்கு மேற்பட்ட நிறுவனத்தில் இருந்தால் இங்கே மாற்றலாம்." },
    ],
  },

  // ---------- Attendance ----------
  {
    id: "attendance", group: "attendance",
    title_en: "Attendance", title_ta: "வருகை",
    intro_en: "Self check-in plus the team grid.",
    intro_ta: "சுய செக்-இன் & குழு பட்டியல்.",
    steps: [
      { en: "Check in when you start and check out when you finish.", ta: "வேலை தொடங்கும்போது செக்-இன், முடிக்கும்போது செக்-அவுட் செய்யுங்கள்." },
      { en: "Summary shows your monthly attendance and hours.", ta: "Summary உங்கள் மாதாந்திர வருகை & நேரத்தைக் காண்பிக்கும்." },
      { en: "Working on Sundays, 1st Saturdays or holidays earns comp-off (never expires).", ta: "ஞாயிறு, முதல் சனி, விடுமுறை நாட்களில் வேலை செய்தால் ஈட்டப்பட்ட விடுப்பு (காலாவதியாகாது) கிடைக்கும்." },
    ],
  },
  {
    id: "calendar", group: "attendance",
    title_en: "Holidays & Calendar", title_ta: "விடுமுறை & நாட்காட்டி",
    intro_en: "Holidays, leaves, tasks and follow-ups in one place.",
    intro_ta: "விடுமுறை, விடுப்பு, பணிகள், ஃபாலோ-அப் ஒரே இடத்தில்.",
    steps: [
      { en: "Holidays lists the company's official days off.", ta: "Holidays நிறுவனத்தின் அதிகாரப்பூர்வ விடுமுறை நாட்களைக் காண்பிக்கும்." },
      { en: "Calendar overlays your holidays, leaves, tasks and follow-ups by date.", ta: "Calendar உங்கள் விடுமுறை, விடுப்பு, பணிகள், ஃபாலோ-அப்களை தேதி வாரியாகக் காண்பிக்கும்." },
    ],
  },

  // ---------- Leads & Sales ----------
  {
    id: "leads", group: "sales",
    title_en: "Leads", title_ta: "லீட்ஸ் (வாய்ப்புகள்)",
    intro_en: "All inbound prospects (potential customers).",
    intro_ta: "அனைத்து புதிய வாய்ப்புகள் (சாத்தியமான வாடிக்கையாளர்கள்).",
    steps: [
      { en: "Add a lead with name, phone, and source.", ta: "பெயர், தொலைபேசி, மூலம் கொண்டு ஒரு லீட் சேர்க்கவும்." },
      { en: "Update the status as it moves: new → contacted → qualified → converted.", ta: "நிலையை மாற்றுங்கள்: new → contacted → qualified → converted." },
      { en: "Add an address so the customer can be plotted on the map.", ta: "வரைபடத்தில் காட்ட முகவரியைச் சேர்க்கவும்." },
    ],
  },
  {
    id: "pipeline", group: "sales",
    title_en: "Pipeline & Quotes", title_ta: "பைப்லைன் & கோட்டேஷன்",
    intro_en: "Track deals and price quotations.",
    intro_ta: "டீல்களையும் விலை கோட்டேஷன்களையும் கண்காணிக்க.",
    steps: [
      { en: "Pipeline shows each opportunity by stage (prospecting → won/lost).", ta: "Pipeline ஒவ்வொரு வாய்ப்பையும் கட்டம் வாரியாகக் காண்பிக்கும்." },
      { en: "Quotes lists quotations synced from Zoho with their value and status.", ta: "Quotes Zoho-விலிருந்து வரும் கோட்டேஷன்களை மதிப்பு & நிலையுடன் காண்பிக்கும்." },
    ],
  },
  {
    id: "followups", group: "sales",
    title_en: "Follow-ups & Complaints", title_ta: "ஃபாலோ-அப் & புகார்கள்",
    intro_en: "Never miss a callback or a customer issue.",
    intro_ta: "எந்த கால்பேக்கையும் வாடிக்கையாளர் பிரச்சினையையும் தவறவிடாதீர்கள்.",
    steps: [
      { en: "Follow-ups are reminders to contact a lead on a date.", ta: "Follow-ups ஒரு லீட்டை குறிப்பிட்ட தேதியில் தொடர்பு கொள்ள நினைவூட்டல்கள்." },
      { en: "Complaints logs customer issues so they can be resolved and tracked.", ta: "Complaints வாடிக்கையாளர் பிரச்சினைகளைப் பதிவு செய்து தீர்க்க உதவும்." },
    ],
  },
  {
    id: "visits", group: "sales",
    title_en: "Visits", title_ta: "வருகைகள் (Field Visits)",
    intro_en: "Field check-ins with a live customer map.",
    intro_ta: "வாடிக்கையாளர் இடங்களுக்கான கள வருகை & வரைபடம்.",
    steps: [
      { en: "Check in at a customer location; it records your GPS position.", ta: "வாடிக்கையாளர் இடத்தில் செக்-இன் செய்யுங்கள்; உங்கள் GPS பதிவாகும்." },
      { en: "The map plots customers. Use Geocode customers to add coordinates from addresses.", ta: "வரைபடம் வாடிக்கையாளர்களைக் காட்டும். முகவரியிலிருந்து இடம் சேர்க்க Geocode customers பயன்படுத்துங்கள்." },
    ],
    tip: {
      en: "Geocoding here is what lets the Margin Calculator estimate delivery distance.",
      ta: "இங்கே ஜியோகோடிங் செய்தால்தான் Margin Calculator டெலிவரி தூரத்தைக் கணக்கிட முடியும்.",
    },
  },

  // ---------- Money & Targets ----------
  {
    id: "collections", group: "money",
    title_en: "Collections", title_ta: "வசூல்",
    intro_en: "Outstanding invoice balances from customers.",
    intro_ta: "வாடிக்கையாளர்களிடமிருந்து வசூலிக்க வேண்டிய தொகை.",
    steps: [
      { en: "See who still owes money and how much, per salesperson.", ta: "யார் எவ்வளவு பாக்கி வைத்திருக்கிறார்கள் என்பதை விற்பனையாளர் வாரியாகக் காணலாம்." },
      { en: "Use it to plan follow-up calls for payment.", ta: "பணம் வசூலிக்க ஃபாலோ-அப் செய்ய இதைப் பயன்படுத்துங்கள்." },
    ],
  },
  {
    id: "expenses", group: "money",
    title_en: "Expenses & Payments", title_ta: "செலவுகள் & பணம்",
    intro_en: "Record spending and (admins) approve payouts.",
    intro_ta: "செலவுகளைப் பதிவு செய்யுங்கள்; (நிர்வாகி) பணம் அனுமதிக்கலாம்.",
    steps: [
      { en: "Submit an expense with amount, category and customer if relevant.", ta: "தொகை, வகை, வாடிக்கையாளருடன் ஒரு செலவைச் சமர்ப்பிக்கவும்." },
      { en: "Payments (admins) shows what's due to staff/vendors.", ta: "Payments (நிர்வாகி) ஊழியர்/விற்பனையாளருக்கு செலுத்த வேண்டியதைக் காண்பிக்கும்." },
    ],
  },
  {
    id: "paymentqr", group: "money",
    title_en: "Payment QR", title_ta: "பணம் QR",
    intro_en: "A QR code customers can scan to pay you.",
    intro_ta: "வாடிக்கையாளர்கள் ஸ்கேன் செய்து பணம் செலுத்த QR கோடு.",
    steps: [
      { en: "Show this QR to a customer to collect payment instantly.", ta: "உடனடியாக பணம் பெற வாடிக்கையாளருக்கு இந்த QR-ஐக் காட்டுங்கள்." },
    ],
  },
  {
    id: "targets", group: "money",
    title_en: "Targets & Performance", title_ta: "இலக்குகள் & செயல்திறன்",
    intro_en: "Sales goals and how each salesperson is doing.",
    intro_ta: "விற்பனை இலக்குகள் & ஒவ்வொரு விற்பனையாளரின் செயல்திறன்.",
    steps: [
      { en: "Targets shows the goal vs. achieved for the period.", ta: "Targets இலக்கை vs. அடைந்ததைக் காண்பிக்கும்." },
      { en: "Salesperson performance ranks the team by results.", ta: "Salesperson performance முடிவுகளின் அடிப்படையில் குழுவை வரிசைப்படுத்தும்." },
    ],
  },

  // ---------- Products & Pricing ----------
  {
    id: "templates", group: "pricing",
    title_en: "Product Price List", title_ta: "பொருள் விலை பட்டியல்",
    intro_en: "Your catalog synced from Zoho — selling price, cost price, margin.",
    intro_ta: "Zoho-விலிருந்து உங்கள் பொருட்கள் — விற்பனை விலை, கொள்முதல் விலை, மார்ஜின்.",
    steps: [
      { en: "Search and filter products by category.", ta: "வகை வாரியாக பொருட்களைத் தேடவும்/வடிகட்டவும்." },
      { en: "Click a cost price to edit it; the margin % updates.", ta: "கொள்முதல் விலையை அழுத்தித் திருத்தவும்; மார்ஜின் % புதுப்பிக்கும்." },
      { en: "Sort by margin to find low-profit items quickly.", ta: "குறைந்த லாப பொருட்களைக் கண்டுபிடிக்க மார்ஜின் வாரியாக வரிசைப்படுத்தவும்." },
    ],
  },
  {
    id: "pricelists", group: "pricing",
    title_en: "Customer Price Lists", title_ta: "வாடிக்கையாளர் விலை பட்டியல்",
    intro_en: "Special prices agreed with specific customers.",
    intro_ta: "குறிப்பிட்ட வாடிக்கையாளர்களுக்கான சிறப்பு விலைகள்.",
    steps: [
      { en: "Pick a customer and set custom rates per item (or bulk-upload a CSV).", ta: "ஒரு வாடிக்கையாளரைத் தேர்வு செய்து தனிப்பயன் விலைகளை அமைக்கவும் (அல்லது CSV பதிவேற்றவும்)." },
      { en: "These rates load automatically in the Margin Calculator for that customer.", ta: "இந்த விலைகள் அந்த வாடிக்கையாளருக்கு Margin Calculator-ல் தானாக வரும்." },
    ],
  },
  {
    id: "margin", group: "pricing",
    title_en: "Margin Calculator", title_ta: "விலை & லாப கணக்கீடு",
    intro_en: "Work out the profit on an order before quoting.",
    intro_ta: "ஒரு ஆர்டருக்கு விலை சொல்வதற்கு முன் லாபத்தைக் கணக்கிட.",
    steps: [
      { en: "Customer — pick an existing one, or type a new name.", ta: "Customer — இருப்பவரைத் தேர்வு செய்யுங்கள், அல்லது புதிய பெயரைத் தட்டச்சு செய்யுங்கள்." },
      { en: "Referred by — choose the referrer; their commission % loads automatically.", ta: "Referred by — அறிமுகப்படுத்தியவரைத் தேர்வு செய்யுங்கள்; அவரின் கமிஷன் % தானாக வரும்." },
      { en: "Add items two ways: (a) pick an item from the dropdown — its cost and selling price load from our system, or (b) Upload Quote PDF to fill items, qty and selling price automatically.", ta: "பொருட்களைச் சேர்க்க இரண்டு வழிகள்: (அ) drop-down-ல் ஒரு பொருளைத் தேர்வு செய்யுங்கள் — அதன் கொள்முதல் & விற்பனை விலை நம் சிஸ்டத்திலிருந்து வரும், அல்லது (ஆ) Upload Quote PDF மூலம் பொருட்கள்/அளவு/விற்பனை விலையை தானாக நிரப்பவும்." },
      { en: "Cost Price — auto-filled for catalog items; type it for new items. Profit % shows instantly.", ta: "Cost Price — பட்டியல் பொருட்களுக்கு தானாக வரும்; புதிய பொருட்களுக்கு தட்டச்சு செய்யுங்கள். லாப % உடனே தெரியும்." },
      { en: "Commission % — defaults to the referrer's rate; edit it for a customer's first invoice.", ta: "Commission % — இயல்பு விகிதம் வரும்; முதல் இன்வாய்ஸுக்கு திருத்துங்கள்." },
      { en: "Delivery (optional) — estimates distance from Coimbatore (₹15/km, editable) with a route map.", ta: "Delivery (விருப்பம்) — கோயம்புத்தூரிலிருந்து தூரத்தைக் கணக்கிடும் (₹15/கி.மீ) + வரைபடம்." },
      { en: "Download PDF — a clean report with items, totals, commission and delivery.", ta: "Download PDF — பொருட்கள், மொத்தம், கமிஷன், டெலிவரி கொண்ட அறிக்கை." },
    ],
    tip: {
      en: "Selecting a customer first loads their special prices and referral commission automatically.",
      ta: "முதலில் வாடிக்கையாளரைத் தேர்வு செய்தால் அவரின் சிறப்பு விலை & கமிஷன் தானாக ஏற்றப்படும்.",
    },
  },

  // ---------- Referrals ----------
  {
    id: "referral-customers", group: "referral",
    title_en: "Referral Customers", title_ta: "அறிமுக வாடிக்கையாளர்கள்",
    intro_en: "Link customers to the person who referred them.",
    intro_ta: "வாடிக்கையாளர்களை அறிமுகப்படுத்தியவருடன் இணையுங்கள்.",
    steps: [
      { en: "Customers detected from Zoho appear under Detected — click Link → to confirm.", ta: "Zoho-வில் கண்டறியப்பட்டவர்கள் Detected-ல் வரும் — Link → அழுத்துங்கள்." },
      { en: "Or use + Link Customer to Referrer to link manually.", ta: "அல்லது + Link Customer to Referrer மூலம் கைமுறையாக இணையுங்கள்." },
    ],
  },
  {
    id: "referrers", group: "referral",
    title_en: "Referrers & Commission", title_ta: "அறிமுகப்படுத்தியவர் & கமிஷன்",
    intro_en: "Set rates and see commission per referrer.",
    intro_ta: "விகிதங்களை அமைத்து ஒவ்வொருவரின் கமிஷனைப் பார்க்க.",
    steps: [
      { en: "Open Referrers, click a name, and set rates with Edit (Default %, 1st Invoice %, etc.).", ta: "Referrers திறந்து, பெயரை அழுத்தி, Edit மூலம் விகிதங்களை அமைக்கவும்." },
      { en: "Referred Customer Invoices lists all invoices; commission is on the pre-GST value.", ta: "Referred Customer Invoices அனைத்து இன்வாய்ஸுகளையும் காண்பிக்கும்; கமிஷன் GST-க்கு முன் தொகையில்." },
      { en: "The earliest invoice per customer uses the 1st-invoice rate. Click Download PDF for a statement.", ta: "ஒவ்வொரு வாடிக்கையாளரின் முதல் இன்வாய்ஸ் முதல்-இன்வாய்ஸ் விகிதத்தைப் பயன்படுத்தும். அறிக்கைக்கு Download PDF." },
    ],
  },

  // ---------- Tasks ----------
  {
    id: "tasks", group: "tasks",
    title_en: "Tasks & Routines", title_ta: "பணிகள் & வழக்கமான பணிகள்",
    intro_en: "Your to-dos and recurring work.",
    intro_ta: "உங்கள் செய்ய வேண்டியவை & மீண்டும் வரும் பணிகள்.",
    steps: [
      { en: "Tasks lists what you need to do, with due dates.", ta: "Tasks நீங்கள் செய்ய வேண்டியவற்றை தேதியுடன் காண்பிக்கும்." },
      { en: "Pending report shows overdue items. Routines (admins) auto-create repeating tasks.", ta: "Pending report தாமதமானவற்றைக் காண்பிக்கும். Routines (நிர்வாகி) மீண்டும் வரும் பணிகளை தானாக உருவாக்கும்." },
    ],
  },

  // ---------- Admin ----------
  {
    id: "team", group: "admin",
    title_en: "Team & Integrations", title_ta: "குழு & இணைப்புகள்",
    intro_en: "Manage staff and connect external systems (managers only).",
    intro_ta: "ஊழியர்களை நிர்வகித்து வெளி அமைப்புகளை இணைக்க (மேலாளர்கள் மட்டும்).",
    steps: [
      { en: "Team members: add staff, set roles, and map them to Zoho salesperson names.", ta: "Team members: ஊழியர்களைச் சேர்த்து, பங்குகளை அமைத்து, Zoho பெயர்களுடன் இணைக்கவும்." },
      { en: "Integrations: connect Zoho Books so products, invoices and customers sync in.", ta: "Integrations: பொருட்கள், இன்வாய்ஸ், வாடிக்கையாளர்கள் ஒத்திசைக்க Zoho Books-ஐ இணைக்கவும்." },
    ],
  },
];

export function HelpContent() {
  const [lang, setLang] = useState<"en" | "ta">("en");
  const t = (en: string, ta: string) => (lang === "en" ? en : ta);

  return (
    <div className="flex flex-col gap-8">
      <div className="inline-flex w-fit items-center rounded-md border border-zinc-700 p-0.5 text-sm">
        {(["en", "ta"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded px-3 py-1 font-medium transition-colors ${lang === l ? "bg-[#b5c76a] text-[#1a1a1a]" : "text-zinc-400 hover:bg-zinc-800"}`}
          >
            {l === "en" ? "English" : "தமிழ்"}
          </button>
        ))}
      </div>

      {GROUPS.map((g) => {
        const items = SECTIONS.filter((s) => s.group === g.key);
        if (items.length === 0) return null;
        return (
          <div key={g.key} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#b5c76a]">{t(g.en, g.ta)}</h2>
            {items.map((s) => (
              <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="text-base font-semibold text-zinc-100">{t(s.title_en, s.title_ta)}</h3>
                <p className="mt-1 text-sm text-zinc-400">{t(s.intro_en, s.intro_ta)}</p>
                <ol className="mt-4 flex flex-col gap-2.5">
                  {s.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-zinc-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400">
                        {idx + 1}
                      </span>
                      <span>{t(step.en, step.ta)}</span>
                    </li>
                  ))}
                </ol>
                {s.tip && (
                  <p className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                    💡 {t(s.tip.en, s.tip.ta)}
                  </p>
                )}
              </div>
            ))}
          </div>
        );
      })}

      <p className="text-sm text-zinc-500">{t("Questions? Ask your admin or manager.", "கேள்விகள்? உங்கள் நிர்வாகி அல்லது மேலாளரிடம் கேளுங்கள்.")}</p>
    </div>
  );
}
