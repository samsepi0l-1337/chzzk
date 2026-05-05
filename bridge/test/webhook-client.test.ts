import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MinecraftWebhookClient, signBody } from "../src/webhook-client";

describe("MinecraftWebhookClient", () => {
  it("uses default retry settings for successful delivery", async () => {
    let calls = 0;
    const client = new MinecraftWebhookClient(
      {
        url: "http://127.0.0.1:29371/chzzk/donations",
        sharedSecret: "secret"
      },
      async () => {
        calls += 1;
        return new Response("", { status: 202 });
      }
    );

    await client.send(payload());
    expect(calls).toBe(1);
  });

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
    expect(calls[0].signature).toBe(signBody(calls[0].body, "secret"));
    expect(calls[0].signature).toBe(
      `sha256=${createHmac("sha256", "secret").update(calls[0].body).digest("hex")}`
    );
  });

  it("does not retry permanent failures", async () => {
    const client = new MinecraftWebhookClient(
      {
        url: "http://127.0.0.1:29371/chzzk/donations",
        sharedSecret: "secret",
        maxAttempts: 3,
        retryDelayMs: 0
      },
      async () => new Response("bad signature", { status: 401 })
    );

    await expect(client.send(payload())).rejects.toThrow(/401 bad signature/);
  });

  it("uses safe minimum retry settings and rethrows final fetch errors", async () => {
    let calls = 0;
    const client = new MinecraftWebhookClient(
      {
        url: "http://127.0.0.1:29371/chzzk/donations",
        sharedSecret: "secret",
        maxAttempts: 0,
        retryDelayMs: -1
      },
      async () => {
        calls += 1;
        throw new Error("network down");
      }
    );

    await expect(client.send(payload())).rejects.toThrow(/network down/);
    expect(calls).toBe(1);
  });

  it("retries thrown fetch errors with a non-zero delay", async () => {
    let calls = 0;
    const client = new MinecraftWebhookClient(
      {
        url: "http://127.0.0.1:29371/chzzk/donations",
        sharedSecret: "secret",
        maxAttempts: 2,
        retryDelayMs: 1
      },
      async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("temporary network down");
        }
        return new Response("", { status: 202 });
      }
    );

    await client.send(payload());
    expect(calls).toBe(2);
  });

  it("reports final transient responses", async () => {
    const client = new MinecraftWebhookClient(
      {
        url: "http://127.0.0.1:29371/chzzk/donations",
        sharedSecret: "secret",
        maxAttempts: 1,
        retryDelayMs: 0
      },
      async () => new Response("busy", { status: 500 })
    );

    await expect(client.send(payload())).rejects.toThrow(/500 busy/);
  });
});

function payload() {
  return {
    eventId: "evt-1",
    amount: 1000,
    donatorNickname: "viewer",
    message: "hello",
    receivedAt: "2026-05-05T00:00:00.000Z"
  };
}
