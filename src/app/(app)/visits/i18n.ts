// Scoped localisation for the Visits route only.
//
// Field reps use this page on a phone, often in Tamil-speaking territory, so
// Visits carries its own dictionary rather than pulling an app-wide i18n
// library in. Kept as plain serialisable data (no functions) so the whole
// dictionary can be handed to client components as a prop. Interpolation uses
// {token} placeholders filled by `fill()` below.

export const VISITS_LANG_COOKIE = "visits_lang";

export const LANGS = ["en", "ta"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  ta: "தமிழ்",
};

export function isLang(v: string | undefined): v is Lang {
  return !!v && (LANGS as readonly string[]).includes(v);
}

// Replace {token} placeholders. Values are stringified as-is.
export function fill(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

const en = {
  // --- page chrome ---
  title: "Visits",
  today: "Today",
  wholeTeam: "whole team",
  member: "member",
  visitCountOne: "{n} visit",
  visitCountMany: "{n} visits",
  tabDaily: "Daily",
  tabMonthly: "Monthly summary",

  // --- filters ---
  date: "Date",
  employee: "Employee",
  allEmployees: "All employees",
  apply: "Apply",
  clearFilters: "Clear · today & everyone",

  // --- active visit ---
  youAreCheckedIn: "You are checked in",
  onSite: "on site",
  atCustomer: "At {name}",
  noCustomerLinked: "(no customer linked)",
  sinceTime: "since {time}",
  minutesAgo: "({n} min ago)",

  // --- check-in ---
  checkInTitle: "Check in to a visit",
  workWindow: "Work-hours window: {start} AM – {end} PM IST",
  checkInGetLocation: "Check in (get location)",
  gettingLocation: "Getting location…",
  locationPrefix: "Location: {message}",
  permissionOff: "Location permission is off — check-in needs it.",
  iosStep1: "iPhone Settings → Privacy & Security → Location Services → turn ON.",
  iosStep2: "Scroll to your browser (Safari Websites or Chrome) → set to While Using.",
  iosStep3: "In Safari on this page, tap aA in the address bar → Website Settings → Location → Allow.",
  iosStep4: "Come back here and tap Retry.",
  androidStep1: "Tap the lock/ⓘ icon in the address bar.",
  androidStep2: "Set Location to Allow.",
  androidStep3: "Make sure the phone's GPS/Location is on.",
  androidStep4: "Tap Retry below.",
  retryLocation: "Retry location",
  retrying: "Retrying…",
  locationLocked: "📍 Location locked: {lat}, {lng}",
  customerLabel: "Customer (optional, closest first)",
  searchCustomer: "Search customer…",
  addNewCustomer: "Add new customer",
  customerNameRequired: "Customer name *",
  customerNameIsRequired: "Customer name is required.",
  phoneOptional: "Phone (optional)",
  quickAddHint:
    "Will save with your current GPS as the customer's location (used for distance sorting next time).",
  saveCustomer: "Save customer",
  noCustomer: "(no customer)",
  noMatchingCustomer: "No matching customer",
  notesOptional: "Notes (optional)",
  purposeOfVisit: "Purpose of visit…",
  confirmCheckIn: "Confirm check-in",
  checkInFailed: "Check-in failed.",

  // --- check-out ---
  checkOut: "Check out",
  visitNotesOptional: "Visit notes (optional)…",
  confirmCheckOut: "Confirm check-out",
  checkOutFailed: "Check-out failed.",

  // --- location test ---
  troubleTitle: "Trouble checking in?",
  troubleHint:
    "Verify your phone shares location (handy on iPhone) without doing a real check-in.",
  testMyLocation: "Test my location",
  testing: "Testing…",
  locationWorks: "Location works",
  accuracyMeters: "accuracy ±{n} m",

  // --- route / map ---
  routeFor: "Route · {name}",
  stops: "Stops",
  routeDistance: "Route distance (approx)",
  timeOnSite: "Time on site",
  travelIdle: "Travel + idle",
  routeNote:
    "Distance is straight-line between consecutive check-ins (not road distance). Numbered pins show the visit order, so a zig-zag route or long travel/idle time stands out.",
  routeMap: "Route map",
  map: "Map",
  hideCustomers: "Hide customers",
  showAllCustomers: "Show all customers",
  nothingForFilter: "Nothing to show for this filter",
  pinsAppearHint: "Pins appear here once team members check in.",
  tryDifferentDate: "Try a different date, or toggle customers on.",
  mapTip:
    "Tip: pick one employee above to see their numbered route and travel stats. Amber shop pins are customer locations.",

  // --- visit list ---
  visitList: "Visit list",
  noVisitsLogged: "No visits logged for this filter",
  noCustomerItalic: "no customer",
  minutesShort: "{n} min",
  checkInAt: "Check-in {time}",
  checkOutAt: "check-out {time}",

  // --- shared ---
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
  geolocationUnsupported: "Geolocation not supported in this browser.",
  locationTimedOut: "Timed out getting location. Move to open sky and retry.",
  locationFailed: "Couldn't get location. Check that GPS/Location is on, then retry.",
  language: "Language",
};

export type Dict = typeof en;

// Tamil. Kept deliberately plain — these are read on a phone, in the field.
const ta: Dict = {
  title: "வருகைகள்",
  today: "இன்று",
  wholeTeam: "முழு குழு",
  member: "ஊழியர்",
  visitCountOne: "{n} வருகை",
  visitCountMany: "{n} வருகைகள்",
  tabDaily: "தினசரி",
  tabMonthly: "மாதாந்திர சுருக்கம்",

  date: "தேதி",
  employee: "ஊழியர்",
  allEmployees: "அனைத்து ஊழியர்கள்",
  apply: "பயன்படுத்து",
  clearFilters: "அழி · இன்று & அனைவரும்",

  youAreCheckedIn: "நீங்கள் வருகை பதிவு செய்துள்ளீர்கள்",
  onSite: "இடத்தில்",
  atCustomer: "{name} இடத்தில்",
  noCustomerLinked: "(வாடிக்கையாளர் இணைக்கப்படவில்லை)",
  sinceTime: "{time} முதல்",
  minutesAgo: "({n} நிமிடங்களுக்கு முன்)",

  checkInTitle: "வருகையைப் பதிவு செய்",
  workWindow: "பணி நேரம்: காலை {start} – மாலை {end} IST",
  checkInGetLocation: "வருகை பதிவு (இருப்பிடம் பெறு)",
  gettingLocation: "இருப்பிடம் பெறப்படுகிறது…",
  locationPrefix: "இருப்பிடம்: {message}",
  permissionOff: "இருப்பிட அனுமதி இல்லை — வருகை பதிவுக்கு இது தேவை.",
  iosStep1: "iPhone Settings → Privacy & Security → Location Services → ON செய்யவும்.",
  iosStep2: "உங்கள் உலாவிக்குச் செல்லவும் (Safari Websites அல்லது Chrome) → While Using என அமைக்கவும்.",
  iosStep3: "இந்தப் பக்கத்தில் Safari-யில், முகவரிப் பட்டியில் aA → Website Settings → Location → Allow.",
  iosStep4: "இங்கு திரும்பி வந்து மீண்டும் முயற்சி செய்யவும்.",
  androidStep1: "முகவரிப் பட்டியில் உள்ள பூட்டு/ⓘ ஐகானைத் தட்டவும்.",
  androidStep2: "Location ஐ Allow என அமைக்கவும்.",
  androidStep3: "தொலைபேசியின் GPS/Location இயக்கத்தில் உள்ளதா எனப் பார்க்கவும்.",
  androidStep4: "கீழே மீண்டும் முயற்சி என்பதைத் தட்டவும்.",
  retryLocation: "இருப்பிடத்தை மீண்டும் முயற்சி",
  retrying: "மீண்டும் முயற்சிக்கிறது…",
  locationLocked: "📍 இருப்பிடம் பதிவானது: {lat}, {lng}",
  customerLabel: "வாடிக்கையாளர் (விருப்பம், அருகில் உள்ளவர் முதலில்)",
  searchCustomer: "வாடிக்கையாளரைத் தேடு…",
  addNewCustomer: "புதிய வாடிக்கையாளரைச் சேர்",
  customerNameRequired: "வாடிக்கையாளர் பெயர் *",
  customerNameIsRequired: "வாடிக்கையாளர் பெயர் தேவை.",
  phoneOptional: "தொலைபேசி (விருப்பம்)",
  quickAddHint:
    "உங்கள் தற்போதைய GPS வாடிக்கையாளரின் இருப்பிடமாகச் சேமிக்கப்படும் (அடுத்த முறை தூர வரிசைக்குப் பயன்படும்).",
  saveCustomer: "வாடிக்கையாளரைச் சேமி",
  noCustomer: "(வாடிக்கையாளர் இல்லை)",
  noMatchingCustomer: "பொருந்தும் வாடிக்கையாளர் இல்லை",
  notesOptional: "குறிப்புகள் (விருப்பம்)",
  purposeOfVisit: "வருகையின் நோக்கம்…",
  confirmCheckIn: "வருகையை உறுதிசெய்",
  checkInFailed: "வருகை பதிவு தோல்வியடைந்தது.",

  checkOut: "வெளியேறு",
  visitNotesOptional: "வருகைக் குறிப்புகள் (விருப்பம்)…",
  confirmCheckOut: "வெளியேறுவதை உறுதிசெய்",
  checkOutFailed: "வெளியேறும் பதிவு தோல்வியடைந்தது.",

  troubleTitle: "வருகை பதிவு செய்ய சிக்கலா?",
  troubleHint:
    "உண்மையான வருகை பதிவு செய்யாமல், உங்கள் தொலைபேசி இருப்பிடத்தைப் பகிர்கிறதா எனச் சரிபார்க்கவும்.",
  testMyLocation: "என் இருப்பிடத்தைச் சோதி",
  testing: "சோதிக்கிறது…",
  locationWorks: "இருப்பிடம் வேலை செய்கிறது",
  accuracyMeters: "துல்லியம் ±{n} மீ",

  routeFor: "பாதை · {name}",
  stops: "நிறுத்தங்கள்",
  routeDistance: "பாதைத் தூரம் (தோராயம்)",
  timeOnSite: "இடத்தில் செலவழித்த நேரம்",
  travelIdle: "பயணம் + காத்திருப்பு",
  routeNote:
    "தூரம் என்பது தொடர்ச்சியான வருகைகளுக்கு இடையேயான நேர்கோட்டுத் தூரம் (சாலைத் தூரம் அல்ல). எண்ணிடப்பட்ட குறிகள் வருகை வரிசையைக் காட்டுகின்றன, எனவே நெளிவான பாதை அல்லது நீண்ட பயண/காத்திருப்பு நேரம் தெரியும்.",
  routeMap: "பாதை வரைபடம்",
  map: "வரைபடம்",
  hideCustomers: "வாடிக்கையாளர்களை மறை",
  showAllCustomers: "அனைத்து வாடிக்கையாளர்களையும் காட்டு",
  nothingForFilter: "இந்த வடிகட்டலுக்கு எதுவும் இல்லை",
  pinsAppearHint: "குழு உறுப்பினர்கள் வருகை பதிவு செய்ததும் குறிகள் இங்கு தோன்றும்.",
  tryDifferentDate: "வேறு தேதியை முயற்சிக்கவும், அல்லது வாடிக்கையாளர்களை இயக்கவும்.",
  mapTip:
    "குறிப்பு: மேலே ஒரு ஊழியரைத் தேர்ந்தெடுத்தால் அவரது எண்ணிடப்பட்ட பாதையும் பயணப் புள்ளிவிவரங்களும் தெரியும். ஆம்பர் நிற குறிகள் வாடிக்கையாளர் இருப்பிடங்கள்.",

  visitList: "வருகைப் பட்டியல்",
  noVisitsLogged: "இந்த வடிகட்டலுக்கு வருகைகள் எதுவும் பதிவாகவில்லை",
  noCustomerItalic: "வாடிக்கையாளர் இல்லை",
  minutesShort: "{n} நிமிடம்",
  checkInAt: "வருகை {time}",
  checkOutAt: "வெளியேற்றம் {time}",

  save: "சேமி",
  saving: "சேமிக்கிறது…",
  cancel: "ரத்து செய்",
  geolocationUnsupported: "இந்த உலாவியில் இருப்பிட வசதி ஆதரிக்கப்படவில்லை.",
  locationTimedOut: "இருப்பிடம் பெற நேரம் முடிந்தது. திறந்தவெளிக்குச் சென்று மீண்டும் முயற்சிக்கவும்.",
  locationFailed: "இருப்பிடத்தைப் பெற முடியவில்லை. GPS/Location இயக்கத்தில் உள்ளதா எனப் பார்த்து மீண்டும் முயற்சிக்கவும்.",
  language: "மொழி",
};

const dictionaries: Record<Lang, Dict> = { en, ta };

export function getDict(lang: Lang): Dict {
  return dictionaries[lang];
}
