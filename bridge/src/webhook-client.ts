import { createHmac } from "node:crypto";
import type { MinecraftDonationPayload } from "./donation-parser";

export interface MinecraftWebhookConfig {
  url: string;
  healthUrl?: string;
  sharedSecret: string;
  maxAttempts?: number;
  retryDelayMs?: number;
  readinessMaxAttempts?: number;
  readinessRetryDelayMs?: number;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export class MinecraftWebhookClient {
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;

  constructor(
    private readonly config: MinecraftWebhookConfig,
    private readonly fetcher: Fetcher = fetch
  ) {
    this.maxAttempts = Math.max(1, config.maxAttempts ?? 3);
    this.retryDelayMs = Math.max(0, config.retryDelayMs ?? 500);
  }

  async send(payload: MinecraftDonationPayload): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = signBody(body, this.config.sharedSecret);

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetcher(this.config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Chzzk-Signature": signature
          },
          body
        });

        if (response.ok) {
          return;
        }
        if (!isTransientStatus(response.status) || attempt === this.maxAttempts) {
          throw new Error(`Minecraft webhook failed: ${response.status} ${await response.text()}`);
        }
      } catch (error) {
        if (attempt === this.maxAttempts) {
          throw error;
        }
      }

      await delay(this.retryDelayMs);
    }
  }
}

export function signBody(body: string, sharedSecret: string): string {
  return `sha256=${createHmac("sha256", sharedSecret).update(body).digest("hex")}`;
}

export async function waitForWebhookReady(
  config: MinecraftWebhookConfig,
  fetcher: Fetcher = fetch
): Promise<void> {
  const healthUrl = config.healthUrl ?? `${config.url}/health`;
  const maxAttempts = Math.max(1, config.readinessMaxAttempts ?? 30);
  const retryDelayMs = Math.max(0, config.readinessRetryDelayMs ?? 1000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetcher(healthUrl, { method: "GET" });
      if (response.ok) {
        return;
      }
      if (attempt === maxAttempts) {
        throw new Error(`Minecraft webhook is not ready: ${response.status} ${await response.text()}`);
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
    }
    await delay(retryDelayMs);
  }
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  if (ms === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}
