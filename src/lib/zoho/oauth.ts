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

async function postToken(body: URLSearchParams): Promise<ZohoTokens> {
  const res = await fetch(`${ZOHO_ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Zoho non-JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  // Zoho returns HTTP 200 with { error: "..." } when something is wrong.
  if (!res.ok || typeof json?.access_token !== "string" || typeof json?.expires_in !== "number") {
    const err = (json && (json.error || json.message)) ?? text;
    throw new Error(`Zoho OAuth error: ${typeof err === "string" ? err : JSON.stringify(err)}`);
  }
  return json as unknown as ZohoTokens;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<ZohoTokens> {
  const { id, secret } = getClientCredentials();
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      code,
    })
  );
}

export async function refreshAccessToken(refreshToken: string): Promise<ZohoTokens> {
  const { id, secret } = getClientCredentials();
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
    })
  );
}
