import { CHZZK_OPENAPI_BASE_URL } from "./config";
import type { StoredToken } from "./token-store";

export interface ChzzkRefreshConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  baseUrl?: string;
}

export interface ChzzkCodeExchangeConfig {
  clientId: string;
  clientSecret: string;
  code: string;
  state: string;
  baseUrl?: string;
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

interface ChzzkTokenContent {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  scope?: string;
}

interface ChzzkTokenResponse {
  content?: ChzzkTokenContent;
}

export async function refreshAccessToken(
  config: ChzzkRefreshConfig,
  fetcher: Fetcher = fetch,
  now: Date = new Date()
): Promise<StoredToken> {
  return requestToken(
    config.baseUrl ?? CHZZK_OPENAPI_BASE_URL,
    {
      grantType: "refresh_token",
      refreshToken: config.refreshToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret
    },
    fetcher,
    now
  );
}

export async function exchangeAuthorizationCode(
  config: ChzzkCodeExchangeConfig,
  fetcher: Fetcher = fetch,
  now: Date = new Date()
): Promise<StoredToken> {
  return requestToken(
    config.baseUrl ?? CHZZK_OPENAPI_BASE_URL,
    {
      grantType: "authorization_code",
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code: config.code,
      state: config.state
    },
    fetcher,
    now
  );
}

async function requestToken(
  baseUrl: string,
  body: Record<string, string>,
  fetcher: Fetcher,
  now: Date
): Promise<StoredToken> {
  const response = await fetcher(`${baseUrl}/auth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`CHZZK token request failed: ${response.status} ${text}`);
  }

  const parsed = JSON.parse(text) as ChzzkTokenResponse;
  if (!parsed.content) {
    throw new Error("CHZZK token response missing content");
  }

  return toStoredToken(parsed.content, now);
}

function toStoredToken(content: ChzzkTokenContent, now: Date): StoredToken {
  const expiresInSeconds = Number(content.expiresIn);
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error(`Invalid CHZZK expiresIn: ${content.expiresIn}`);
  }

  return {
    accessToken: content.accessToken,
    refreshToken: content.refreshToken,
    tokenType: content.tokenType,
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
    scope: content.scope
  };
}
