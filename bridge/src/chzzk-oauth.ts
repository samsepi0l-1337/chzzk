import { randomBytes } from "node:crypto";

export const CHZZK_ACCOUNT_INTERLOCK_URL = "https://chzzk.naver.com/account-interlock";

export interface OAuthAuthorizationUrlParams {
  clientId: string;
  redirectUri: string;
  state: string;
}

export interface OAuthCallbackPayload {
  code: string;
  state: string;
}

export function buildAuthorizationUrl(params: OAuthAuthorizationUrlParams): string {
  const url = new URL(CHZZK_ACCOUNT_INTERLOCK_URL);
  url.searchParams.set("clientId", params.clientId);
  url.searchParams.set("redirectUri", params.redirectUri);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export function createOAuthState(): string {
  return randomBytes(16).toString("hex");
}

export function parseOAuthCallback(
  source: URLSearchParams | URL,
  expectedState: string
): OAuthCallbackPayload {
  const searchParams = source instanceof URL ? source.searchParams : source;
  const code = searchParams.get("code")?.trim();
  if (!code) {
    throw new Error("OAuth callback missing code");
  }

  const state = searchParams.get("state")?.trim();
  if (!state) {
    throw new Error("OAuth callback missing state");
  }

  if (state !== expectedState) {
    throw new Error("OAuth callback state mismatch");
  }

  return { code, state };
}
