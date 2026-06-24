"use client";

import { useState } from "react";

type Step = { en: string; ta: string };
type Section = { id: string; title_en: string; title_ta: string; intro_en: string; intro_ta: string; steps: Step[]; tip?: { en: string; ta: string } };

const SECTIONS: Section[] = [
  {
    id: "margin",
    title_en: "Margin Calculator",
    title_ta: "விலை & லாப கணக்கீடு",
    intro_en: "Work out the profit on an order before quoting.",
    intro_ta: "ஒரு ஆர்டருக்கு விலை சொல்வதற்கு முன் லாபத்தைக் கணக்கிட இதைப் பயன்படுத்துங்கள்.",
    steps: [
      { en: "Customer — pick an existing customer from the list, or type a new name.", ta: "Customer (வாடிக்கையாளர்) — பட்டியலில் இருந்து தேர்வு செய்யுங்கள், அல்லது புதிய பெயரைத் தட்டச்சு செய்யுங்கள்." },
      { en: "Referred by — choose the referrer (e.g. Dinesh). Their commission % loads automatically.", ta: "Referred by (யார் அறிமுகம்) — அறிமுகப்படுத்தியவரைத் தேர்வு செய்யுங்கள். அவரின் கமிஷன் % தானாக வரும்." },
      { en: "Date — already set to today; change if needed.", ta: "Date (தேதி) — இன்றைய தேதி இருக்கும்; தேவைப்பட்டால் மாற்றலாம்." },
      { en: "Upload Quote PDF — items, quantity and selling price fill in automatically.", ta: "Upload Quote PDF — பொருட்கள், அளவு, விற்பனை விலை தானாக நிரப்பப்படும்." },
      { en: "Cost Price — type the purchase/cost price for each item. Profit % appears instantly.", ta: "Cost Price (கொள்முதல் விலை) — ஒவ்வொரு பொருளுக்கும் கொள்முதல் விலையைத் தட்டச்சு செய்யுங்கள். லாப % உடனே தெரியும்." },
      { en: "Commission % — shows the referrer's default. For a customer's first invoice, edit it to the first-invoice rate.", ta: "Commission % — இயல்பு % காண்பிக்கும். முதல் இன்வாய்ஸுக்கு முதல்-இன்வாய்ஸ் விகிதத்தை திருத்துங்கள்." },
      { en: "Delivery (optional) — tick to estimate distance from Coimbatore (₹15/km, editable). A small map shows the route.", ta: "Delivery (விருப்பம்) — கோயம்புத்தூரிலிருந்து தூரத்தைக் கணக்கிட தேர்வு செய்யுங்கள் (₹15/கி.மீ). வரைபடம் வழியைக் காண்பிக்கும்." },
      { en: "Download PDF — generates a clean report to print or save.", ta: "Download PDF — அச்சிடவோ சேமிக்கவோ ஒரு அறிக்கை உருவாக்கும்." },
    ],
    tip: {
      en: "If a customer has no location, delivery distance won't auto-fill — geocode them on the Visits page, type the km manually, or leave it.",
      ta: "வாடிக்கையாளருக்கு இடம் இல்லையெனில் தூரம் தானாக வராது — Visits பக்கத்தில் ஜியோகோட் செய்யுங்கள், அல்லது கி.மீ-ஐ கைமுறையாகத் தட்டச்சு செய்யுங்கள்.",
    },
  },
  {
    id: "referral",
    title_en: "Referral Customers",
    title_ta: "அறிமுக வாடிக்கையாளர்கள்",
    intro_en: "Link customers to the person who referred them, so commission can be tracked.",
    intro_ta: "வாடிக்கையாளர்களை அவர்களை அறிமுகப்படுத்தியவருடன் இணையுங்கள், கமிஷனைக் கண்காணிக்க.",
    steps: [
      { en: "Open Referral Customers.", ta: "Referral Customers பக்கத்தைத் திறங்கள்." },
      { en: "Customers detected from Zoho appear under Detected. Click Link → to confirm.", ta: "Zoho-வில் கண்டறியப்பட்டவர்கள் Detected பகுதியில் வரும். Link → அழுத்தி உறுதிப்படுத்துங்கள்." },
      { en: "Or use + Link Customer to Referrer to link manually.", ta: "அல்லது + Link Customer to Referrer மூலம் கைமுறையாக இணையுங்கள்." },
      { en: "Linked customers show in the list with their referrer.", ta: "இணைக்கப்பட்ட வாடிக்கையாளர்கள் பட்டியலில் தெரிவார்கள்." },
    ],
  },
  {
    id: "commission",
    title_en: "Referrer Commission",
    title_ta: "அறிமுகப்படுத்தியவர் கமிஷன்",
    intro_en: "See and report commission for each referrer.",
    intro_ta: "ஒவ்வொரு அறிமுகப்படுத்தியவரின் கமிஷனைப் பார்க்க & அறிக்கை எடுக்க.",
    steps: [
      { en: "Open Referrers and click a name (e.g. Dinesh).", ta: "Referrers திறந்து ஒரு பெயரை அழுத்துங்கள் (உதா: Dinesh)." },
      { en: "Set the rates with Edit — Default %, Traded %, Manufactured %, 1st Invoice %.", ta: "Edit மூலம் விகிதங்களை அமைக்கவும் — Default %, Traded %, Manufactured %, 1st Invoice %." },
      { en: "Referred Customer Invoices lists all invoices. Commission is on the pre-GST value; the earliest invoice per customer uses the 1st-invoice %.", ta: "Referred Customer Invoices அனைத்து இன்வாய்ஸுகளையும் காண்பிக்கும். கமிஷன் GST-க்கு முன் தொகையில்; முதல் இன்வாய்ஸ் முதல்-இன்வாய்ஸ் % பயன்படுத்தும்." },
      { en: "Click Download PDF for a commission statement.", ta: "கமிஷன் அறிக்கைக்கு Download PDF அழுத்துங்கள்." },
    ],
  },
];

export function HelpContent() {
  const [lang, setLang] = useState<"en" | "ta">("en");

  return (
    <div className="flex flex-col gap-6">
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

      {SECTIONS.map((s, i) => (
        <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">
            <span className="mr-2 text-[#b5c76a]">{i + 1}.</span>
            {lang === "en" ? s.title_en : s.title_ta}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{lang === "en" ? s.intro_en : s.intro_ta}</p>
          <ol className="mt-4 flex flex-col gap-2.5">
            {s.steps.map((step, idx) => (
              <li key={idx} className="flex gap-3 text-sm text-zinc-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400">
                  {idx + 1}
                </span>
                <span>{lang === "en" ? step.en : step.ta}</span>
              </li>
            ))}
          </ol>
          {s.tip && (
            <p className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              💡 {lang === "en" ? s.tip.en : s.tip.ta}
            </p>
          )}
        </div>
      ))}

      <p className="text-sm text-zinc-500">
        {lang === "en" ? "Questions? Ask the admin." : "கேள்விகள்? நிர்வாகியிடம் கேளுங்கள்."}
      </p>
    </div>
  );
}
