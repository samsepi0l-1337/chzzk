import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { loadBridgeConfig } from "./config";
import type { MinecraftDonationPayload } from "./donation-parser";
import { signBody } from "./webhook-client";

export const DONATION_TIER_AMOUNTS = [
  1000,
  2000,
  3000,
  5000,
  10000,
  30000,
  50000,
  100000
] as const;

const DEFAULT_WEBHOOK_URL = "http://127.0.0.1:29371/chzzk/donations";

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
type TokenStoreExists = (path: string) => Promise<boolean>;

export interface E2eWebhookOptions {
  amount: number;
  eventId: string;
  webhookUrl: string;
  donatorNickname: string;
  message: string;
  receivedAt: string;
}

export interface SignedWebhookRequest {
  url: string;
  body: string;
  headers: Record<string, string>;
}

export interface E2eHttpResult {
  ok: boolean;
  status: number;
  body: string;
}

export interface E2eHealthResult extends E2eHttpResult {
  url: string;
}

export interface BridgeE2eEnvResult {
  ok: boolean;
  present: string[];
  missing: string[];
  invalid: string[];
  tokenStorePath: string;
}

interface ParseWebhookDeps {
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  createEventId?: () => string;
}

export function parseWebhookArgs(argv: string[], deps: ParseWebhookDeps = {}): E2eWebhookOptions {
  rejectUnknownArgs(argv, [
    "--amount",
    "--event-id",
    "--url",
    "--nickname",
    "--message",
    "--received-at"
  ]);

  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => new Date());
  const createEventId = deps.createEventId ?? (() => `e2e-${randomUUID()}`);
  const amount = parseTierAmount(readRequiredArg(argv, "--amount"), "--amount");

  return {
    amount,
    eventId: readOptionalArg(argv, "--event-id") ?? createEventId(),
    webhookUrl: readOptionalArg(argv, "--url") ?? env.MINECRAFT_WEBHOOK_URL ?? DEFAULT_WEBHOOK_URL,
    donatorNickname: readOptionalArg(argv, "--nickname") ?? "e2e-webhook",
    message: readOptionalArg(argv, "--message") ?? "e2e webhook smoke",
    receivedAt: readOptionalArg(argv, "--received-at") ?? now().toISOString()
  };
}

export function buildSignedWebhookRequest(
  options: E2eWebhookOptions,
  sharedSecret: string
): SignedWebhookRequest {
  const payload: MinecraftDonationPayload = {
    eventId: options.eventId,
    amount: options.amount,
    donatorNickname: options.donatorNickname,
    message: options.message,
    receivedAt: options.receivedAt
  };
  const body = JSON.stringify(payload);

  return {
    url: options.webhookUrl,
    body,
    headers: {
      "Content-Type": "application/json",
      "X-Chzzk-Signature": signBody(body, sharedSecret)
    }
  };
}

export async function sendSignedWebhookDonation(
  options: E2eWebhookOptions,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: Fetcher = fetch
): Promise<E2eHttpResult> {
  const secret = requireEnv(env, "MINECRAFT_WEBHOOK_SECRET");
  const request = buildSignedWebhookRequest(options, secret);
  const response = await fetcher(request.url, {
    method: "POST",
    headers: request.headers,
    body: request.body
  });

  return {
    ok: response.ok,
    status: response.status,
    body: await response.text()
  };
}

export async function checkWebhookHealth(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: Fetcher = fetch
): Promise<E2eHealthResult> {
  const url = env.MINECRAFT_WEBHOOK_HEALTH_URL ?? `${env.MINECRAFT_WEBHOOK_URL ?? DEFAULT_WEBHOOK_URL}/health`;
  const response = await fetcher(url, { method: "GET" });

  return {
    ok: response.ok,
    status: response.status,
    body: await response.text(),
    url
  };
}

export async function checkBridgeE2eEnv(
  env: NodeJS.ProcessEnv = process.env,
  tokenStoreExists: TokenStoreExists = pathExists
): Promise<BridgeE2eEnvResult> {
  const present: string[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const name of [
    "CHZZK_CLIENT_ID",
    "CHZZK_CLIENT_SECRET",
    "CHZZK_CHANNEL_ID",
    "MINECRAFT_WEBHOOK_SECRET"
  ]) {
    if (env[name]?.trim()) {
      present.push(name);
    } else {
      missing.push(name);
    }
  }

  let tokenStorePath = resolve(env.CHZZK_TOKEN_STORE ?? ".chzzk-tokens.json");
  let hasTokenStore = false;
  if (missing.length === 0) {
    try {
      const config = loadBridgeConfig(env);
      tokenStorePath = config.tokenStorePath;
    } catch (error) {
      invalid.push((error as Error).message);
    }
  }

  hasTokenStore = await tokenStoreExists(tokenStorePath);
  if (hasTokenStore) {
    present.push("token store");
  } else {
    missing.push("token store");
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    present,
    missing,
    invalid,
    tokenStorePath
  };
}

function readRequiredArg(argv: string[], name: string): string {
  const value = readOptionalArg(argv, name);
  if (value === undefined) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

function readOptionalArg(argv: string[], name: string): string | undefined {
  const inlinePrefix = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inline !== undefined) {
    return inline.slice(inlinePrefix.length);
  }

  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function rejectUnknownArgs(argv: string[], known: string[]): void {
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const name = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (!known.includes(name)) {
      throw new Error(`Unknown argument: ${name}`);
    }
  }
}

function parseTierAmount(value: string, name: string): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${name} must be an integer`);
  }

  const amount = Number(value);
  if (!DONATION_TIER_AMOUNTS.some((tier) => tier === amount)) {
    throw new Error(`${name} must be one of: ${DONATION_TIER_AMOUNTS.join(", ")}`);
  }
  return amount;
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
