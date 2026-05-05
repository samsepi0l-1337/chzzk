import { resolve } from "node:path";

export const CHZZK_OPENAPI_BASE_URL = "https://openapi.chzzk.naver.com";

export interface BridgeConfig {
  chzzk: {
    clientId: string;
    clientSecret: string;
    baseUrl: string;
  };
  tokenStorePath: string;
  minecraftWebhook: {
    url: string;
    sharedSecret: string;
    maxAttempts: number;
    retryDelayMs: number;
  };
}

export function loadBridgeConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  return {
    chzzk: {
      clientId: required(env.CHZZK_CLIENT_ID, "CHZZK_CLIENT_ID"),
      clientSecret: required(env.CHZZK_CLIENT_SECRET, "CHZZK_CLIENT_SECRET"),
      baseUrl: env.CHZZK_OPENAPI_BASE_URL ?? CHZZK_OPENAPI_BASE_URL
    },
    tokenStorePath: resolve(env.CHZZK_TOKEN_STORE ?? ".chzzk-tokens.json"),
    minecraftWebhook: {
      url: env.MINECRAFT_WEBHOOK_URL ?? "http://127.0.0.1:29371/chzzk/donations",
      sharedSecret: required(env.MINECRAFT_WEBHOOK_SECRET, "MINECRAFT_WEBHOOK_SECRET"),
      maxAttempts: parsePositiveInt(env.WEBHOOK_MAX_ATTEMPTS, 3, "WEBHOOK_MAX_ATTEMPTS"),
      retryDelayMs: parseNonNegativeInt(env.WEBHOOK_RETRY_DELAY_MS, 500, "WEBHOOK_RETRY_DELAY_MS")
    }
  };
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  const parsed = parseNonNegativeInt(value, fallback, name);
  if (parsed <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}
