// Zoho India endpoints. Switch domain if region changes.
export const ZOHO_REGION = "in" as const;

export const ZOHO_ACCOUNTS = `https://accounts.zoho.${ZOHO_REGION}`;
export const ZOHO_API     = `https://www.zohoapis.${ZOHO_REGION}/books/v3`;

export const ZOHO_SCOPES = [
  "ZohoBooks.invoices.READ",
  "ZohoBooks.invoices.CREATE",
  "ZohoBooks.contacts.READ",
  "ZohoBooks.contacts.CREATE",
  "ZohoBooks.items.READ",
  "ZohoBooks.settings.READ",
].join(",");

export function getClientCredentials() {
  const id = process.env.ZOHO_CLIENT_ID;
  const secret = process.env.ZOHO_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET not set in env");
  }
  return { id, secret };
}

export function getRedirectUri(origin: string) {
  return `${origin}/api/zoho/callback`;
}
