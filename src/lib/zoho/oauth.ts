import { ZOHO_ACCOUNTS, ZOHO_SCOPES, getClientCredentials } from "./config";
import type { ZohoTokens } from "./types";

export function buildAuthUrl(redirectUri: string, state: string) {
  const { id } = getClientCredentials();
  const url = new URL(`${ZOHO_ACCOUNTS}/oauth/v2/auth`);
  url.searchParams.set("scope", ZOHO_SCOPES);
  url.searchParams.set("client_id", id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<ZohoTokens> {
  const { id, secret } = getClientCredentials();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${ZOHO_ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Zoho token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as ZohoTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<ZohoTokens> {
  const { id, secret } = getClientCredentials();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: id,
    client_secret: secret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${ZOHO_ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Zoho refresh failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as ZohoTokens;
}
