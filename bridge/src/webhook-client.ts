import { createHmac } from "node:crypto";
import type { MinecraftDonationPayload } from "./donation-parser";

export interface MinecraftWebhookConfig {
  url: string;
  sharedSecret: string;
  maxAttempts?: number;
  retryDelayMs?: number;
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
    let lastError: unknown;

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
        lastError = new Error(`Minecraft webhook transient failure: ${response.status}`);
      } catch (error) {
        lastError = error;
        if (attempt === this.maxAttempts) {
          throw error;
        }
      }

      await delay(this.retryDelayMs);
    }

    throw lastError instanceof Error ? lastError : new Error("Minecraft webhook failed");
  }
}

export function signBody(body: string, sharedSecret: string): string {
  return `sha256=${createHmac("sha256", sharedSecret).update(body).digest("hex")}`;
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
