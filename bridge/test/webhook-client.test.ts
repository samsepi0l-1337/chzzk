import { describe, expect, it } from "vitest";
import { MinecraftWebhookClient } from "../src/webhook-client";

describe("MinecraftWebhookClient", () => {
  it("signs raw JSON and retries transient failures with the same event id", async () => {
    const calls: { signature: string; body: string }[] = [];
    const fetcher = async (_url: string, init: RequestInit) => {
      calls.push({
        signature: String(new Headers(init.headers).get("X-Chzzk-Signature")),
        body: String(init.body)
      });
      return new Response("{}", { status: calls.length === 1 ? 500 : 202 });
    };
    const client = new MinecraftWebhookClient(
      {
        url: "http://127.0.0.1:29371/chzzk/donations",
        sharedSecret: "secret",
        maxAttempts: 2,
        retryDelayMs: 0
      },
      fetcher
    );

    await client.send({
      eventId: "evt-1",
      amount: 1000,
      donatorNickname: "viewer",
      message: "hello",
      receivedAt: "2026-05-05T00:00:00.000Z"
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].body).toBe(calls[1].body);
    expect(calls[0].signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
