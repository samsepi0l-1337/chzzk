import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MinecraftWebhookClient, signBody, waitForWebhookReady } from "../src/webhook-client";

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

  it.each([400, 401, 405, 409, 413])("does not retry permanent HTTP %i failures", async (status) => {
    let calls = 0;
    const client = new MinecraftWebhookClient(
      {
        url: "http://127.0.0.1:29371/chzzk/donations",
        sharedSecret: "secret",
        maxAttempts: 3,
        retryDelayMs: 0
      },
      async () => {
        calls += 1;
        return new Response("permanent failure", { status });
      }
    );

    await expect(client.send(payload())).rejects.toThrow(`${status} permanent failure`);
    expect(calls).toBe(1);
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

  it("waits for webhook health before opening the live session", async () => {
    const calls: string[] = [];

    await waitForWebhookReady(
      {
        url: "http://paper:29371/chzzk/donations",
        healthUrl: "http://paper:29371/chzzk/donations/health",
        sharedSecret: "secret",
        readinessMaxAttempts: 2,
        readinessRetryDelayMs: 0
      },
      async (url, init) => {
        calls.push(`${init.method} ${url}`);
        return new Response("", { status: calls.length === 1 ? 503 : 200 });
      }
    );

    expect(calls).toEqual([
      "GET http://paper:29371/chzzk/donations/health",
      "GET http://paper:29371/chzzk/donations/health"
    ]);
  });

  it("reports final webhook readiness failures", async () => {
    await expect(waitForWebhookReady(
      {
        url: "http://paper:29371/chzzk/donations",
        sharedSecret: "secret",
        readinessMaxAttempts: 1,
        readinessRetryDelayMs: 0
      },
      async () => new Response("not ready", { status: 503 })
    )).rejects.toThrow(/Minecraft webhook is not ready: 503 not ready/);
  });

  it("uses default readiness health URL and safe minimum settings", async () => {
    const calls: string[] = [];

    await waitForWebhookReady(
      {
        url: "http://paper:29371/chzzk/donations",
        sharedSecret: "secret",
        readinessMaxAttempts: 0,
        readinessRetryDelayMs: -1
      },
      async (url) => {
        calls.push(url);
        return new Response("", { status: 200 });
      }
    );

    expect(calls).toEqual(["http://paper:29371/chzzk/donations/health"]);
  });

  it("uses default readiness attempt and delay settings", async () => {
    const calls: string[] = [];

    await waitForWebhookReady(
      {
        url: "http://paper:29371/chzzk/donations",
        sharedSecret: "secret"
      },
      async (url) => {
        calls.push(url);
        return new Response("", { status: 200 });
      }
    );

    expect(calls).toEqual(["http://paper:29371/chzzk/donations/health"]);
  });

  it("retries transient webhook readiness fetch errors", async () => {
    let calls = 0;

    await waitForWebhookReady(
      {
        url: "http://paper:29371/chzzk/donations",
        sharedSecret: "secret",
        readinessMaxAttempts: 2,
        readinessRetryDelayMs: 0
      },
      async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("temporary network down");
        }
        return new Response("", { status: 200 });
      }
    );

    expect(calls).toBe(2);
  });

  it("rethrows final webhook readiness fetch errors", async () => {
    await expect(waitForWebhookReady(
      {
        url: "http://paper:29371/chzzk/donations",
        sharedSecret: "secret",
        readinessMaxAttempts: 1,
        readinessRetryDelayMs: 0
      },
      async () => {
        throw new Error("network down");
      }
    )).rejects.toThrow(/network down/);
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
