// Zoho is multi-data-center. Each connected org may live in a different region,
// so endpoints AND the OAuth client are chosen per region.

export type ZohoRegion = "in" | "com" | "eu" | "com.au" | "jp" | "ca" | "sa";
export const DEFAULT_ZOHO_REGION: ZohoRegion = "in";

export const ZOHO_REGIONS: { value: ZohoRegion; label: string }[] = [
  { value: "in", label: "India (zoho.in)" },
  { value: "com", label: "US / Global (zoho.com)" },
  { value: "eu", label: "Europe (zoho.eu)" },
  { value: "com.au", label: "Australia (zoho.com.au)" },
  { value: "jp", label: "Japan (zoho.jp)" },
  { value: "ca", label: "Canada (zohocloud.ca)" },
  { value: "sa", label: "Saudi Arabia (zoho.sa)" },
];

export function isZohoRegion(v: string | null | undefined): v is ZohoRegion {
  return !!v && ZOHO_REGIONS.some((r) => r.value === v);
}

export function accountsBase(region: ZohoRegion): string {
  return `https://accounts.zoho.${region}`;
}

export function apiBase(region: ZohoRegion): string {
  return `https://www.zohoapis.${region}/books/v3`;
}

export const ZOHO_SCOPES = [
  "ZohoBooks.invoices.READ",
  "ZohoBooks.invoices.CREATE",
  "ZohoBooks.estimates.READ",
  "ZohoBooks.contacts.READ",
  "ZohoBooks.contacts.CREATE",
  "ZohoBooks.items.READ",
  "ZohoBooks.expenses.READ",
  "ZohoBooks.settings.READ",
].join(",");

// Per-region OAuth client credentials. India uses the original env vars; other
// regions use a suffixed pair, e.g. ZOHO_CLIENT_ID_COM / ZOHO_CLIENT_SECRET_COM.
export function getClientCredentials(region: ZohoRegion = DEFAULT_ZOHO_REGION) {
  const suffix = region === "in" ? "" : `_${region.toUpperCase().replace(/\./g, "_")}`;
  const id = process.env[`ZOHO_CLIENT_ID${suffix}`];
  const secret = process.env[`ZOHO_CLIENT_SECRET${suffix}`];
  if (!id || !secret) {
    throw new Error(
      `Zoho client credentials for region "${region}" are not set ` +
        `(need ZOHO_CLIENT_ID${suffix} / ZOHO_CLIENT_SECRET${suffix}).`
    );
  }
  return { id, secret };
}

export function getRedirectUri(origin: string) {
  return `${origin}/api/zoho/callback`;
}
