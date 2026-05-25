import { createHmac } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DONATION_TIER_AMOUNTS,
  buildSignedWebhookRequest,
  checkBridgeE2eEnv,
  checkWebhookHealth,
  parseWebhookArgs,
  sendSignedWebhookDonation
} from "../src/e2e-tools";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("e2e-tools", () => {
  it("documents every supported donation tier amount", () => {
    expect(DONATION_TIER_AMOUNTS).toEqual([
      1000,
      2000,
      3000,
      5000,
      10000,
      30000,
      50000,
      100000
    ]);
  });

  it("parses webhook arguments into a deterministic donation payload", () => {
    const options = parseWebhookArgs(
      [
        "--amount",
        "1000",
        "--event-id=e2e-fixed",
        "--nickname",
        "tester",
        "--message",
        "hello"
      ],
      {
        env: {
          MINECRAFT_WEBHOOK_URL: "http://paper:29371/chzzk/donations"
        },
        now: () => new Date("2026-05-05T00:00:00.000Z"),
        createEventId: () => "unused"
      }
    );

    expect(options).toEqual({
      amount: 1000,
      eventId: "e2e-fixed",
      webhookUrl: "http://paper:29371/chzzk/donations",
      donatorNickname: "tester",
      message: "hello",
      receivedAt: "2026-05-05T00:00:00.000Z"
    });
  });

  it("uses safe defaults for optional webhook arguments", () => {
    const options = parseWebhookArgs(["--amount=2000"], {
      env: {},
      now: () => new Date("2026-05-05T00:00:00.000Z"),
      createEventId: () => "e2e-generated"
    });

    expect(options).toEqual({
      amount: 2000,
      eventId: "e2e-generated",
      webhookUrl: "http://127.0.0.1:29371/chzzk/donations",
      donatorNickname: "e2e-webhook",
      message: "e2e webhook smoke",
      receivedAt: "2026-05-05T00:00:00.000Z"
    });
  });

  it("can generate default event metadata from the current process", () => {
    const options = parseWebhookArgs(["--amount=1000"]);

    expect(options.eventId).toMatch(/^e2e-/);
    expect(Number.isNaN(Date.parse(options.receivedAt))).toBe(false);
  });

  it("rejects missing, invalid, non-tier, and unknown webhook arguments", () => {
    expect(() => parseWebhookArgs([], { env: {} })).toThrow(/Missing required argument: --amount/);
    expect(() => parseWebhookArgs(["--amount", "abc"], { env: {} })).toThrow(/--amount must be an integer/);
    expect(() => parseWebhookArgs(["--amount", "1500"], { env: {} })).toThrow(/must be one of/);
    expect(() => parseWebhookArgs(["--amount", "1000", "--unknown"], { env: {} })).toThrow(/Unknown argument/);
    expect(() => parseWebhookArgs(["--amount"], { env: {} })).toThrow(/Missing value for --amount/);
    expect(() => parseWebhookArgs(["--amount", "--event-id", "x"], { env: {} })).toThrow(/Missing value for --amount/);
  });

  it("builds the exact signed webhook body expected by the plugin protocol", () => {
    const request = buildSignedWebhookRequest(
      {
        amount: 1000,
        eventId: "e2e-fixed",
        webhookUrl: "http://127.0.0.1:29371/chzzk/donations",
        donatorNickname: "tester",
        message: "hello",
        receivedAt: "2026-05-05T00:00:00.000Z"
      },
      "shared-secret"
    );

    expect(request.url).toBe("http://127.0.0.1:29371/chzzk/donations");
    expect(JSON.parse(request.body)).toEqual({
      eventId: "e2e-fixed",
      amount: 1000,
      donatorNickname: "tester",
      message: "hello",
      receivedAt: "2026-05-05T00:00:00.000Z"
    });
    expect(request.headers).toEqual({
      "Content-Type": "application/json",
      "X-Chzzk-Signature": `sha256=${createHmac("sha256", "shared-secret").update(request.body).digest("hex")}`
    });
  });

  it("sends a signed webhook donation using only env-provided secret", async () => {
    const fetcher = vi.fn<Parameters<typeof sendSignedWebhookDonation>[2]>().mockResolvedValue(
      new Response("{\"status\":\"ACCEPTED\"}", { status: 202 })
    );

    const result = await sendSignedWebhookDonation(
      {
        amount: 1000,
        eventId: "e2e-fixed",
        webhookUrl: "http://127.0.0.1:29371/chzzk/donations",
        donatorNickname: "tester",
        message: "hello",
        receivedAt: "2026-05-05T00:00:00.000Z"
      },
      { MINECRAFT_WEBHOOK_SECRET: "shared-secret" },
      fetcher
    );

    expect(result).toEqual({
      ok: true,
      status: 202,
      body: "{\"status\":\"ACCEPTED\"}"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:29371/chzzk/donations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Chzzk-Signature": expect.stringMatching(/^sha256=/)
        }),
        body: expect.stringContaining("\"eventId\":\"e2e-fixed\"")
      })
    );
  });

  it("fails clearly when the webhook secret is missing", async () => {
    await expect(
      sendSignedWebhookDonation(
        {
          amount: 1000,
          eventId: "e2e-fixed",
          webhookUrl: "http://127.0.0.1:29371/chzzk/donations",
          donatorNickname: "tester",
          message: "hello",
          receivedAt: "2026-05-05T00:00:00.000Z"
        },
        {},
        async () => new Response("", { status: 202 })
      )
    ).rejects.toThrow(/Missing required environment variable: MINECRAFT_WEBHOOK_SECRET/);
  });

  it("checks webhook health URL without requiring secrets", async () => {
    const fetcher = vi.fn<Parameters<typeof checkWebhookHealth>[1]>().mockResolvedValue(
      new Response("{\"status\":\"ok\"}", { status: 200 })
    );

    const result = await checkWebhookHealth(
      {
        MINECRAFT_WEBHOOK_URL: "http://paper:29371/chzzk/donations"
      },
      fetcher
    );

    expect(result).toEqual({
      ok: true,
      status: 200,
      body: "{\"status\":\"ok\"}",
      url: "http://paper:29371/chzzk/donations/health"
    });
    expect(fetcher).toHaveBeenCalledWith("http://paper:29371/chzzk/donations/health", { method: "GET" });
  });

  it("honors an explicit webhook health URL", async () => {
    const result = await checkWebhookHealth(
      {
        MINECRAFT_WEBHOOK_HEALTH_URL: "http://paper:29371/ready"
      },
      async () => new Response("not ready", { status: 503 })
    );

    expect(result).toEqual({
      ok: false,
      status: 503,
      body: "not ready",
      url: "http://paper:29371/ready"
    });
  });

  it("reports bridge e2e env readiness without exposing secret values", async () => {
    const result = await checkBridgeE2eEnv(
      {
        CHZZK_CLIENT_ID: "client",
        CHZZK_CLIENT_SECRET: "client-secret",
        CHZZK_CHANNEL_ID: "channel",
        MINECRAFT_WEBHOOK_SECRET: "webhook-secret",
        CHZZK_TOKEN_STORE: "/tmp/tokens.json"
      },
      async () => true
    );

    expect(result).toEqual({
      ok: true,
      present: [
        "CHZZK_CLIENT_ID",
        "CHZZK_CLIENT_SECRET",
        "CHZZK_CHANNEL_ID",
        "MINECRAFT_WEBHOOK_SECRET",
        "token store"
      ],
      missing: [],
      invalid: [],
      tokenStorePath: "/tmp/tokens.json"
    });
    expect(JSON.stringify(result)).not.toContain("client-secret");
    expect(JSON.stringify(result)).not.toContain("webhook-secret");
  });

  it("accepts an existing token store when no refresh token is set", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "chzzk-e2e-env-"));
    const tokenStorePath = join(tempDir, ".chzzk-tokens.json");
    await writeFile(tokenStorePath, "{}", "utf8");

    const result = await checkBridgeE2eEnv({
      CHZZK_CLIENT_ID: "client",
      CHZZK_CLIENT_SECRET: "client-secret",
      CHZZK_CHANNEL_ID: "channel",
      MINECRAFT_WEBHOOK_SECRET: "webhook-secret",
      CHZZK_TOKEN_STORE: tokenStorePath
    });

    expect(result.ok).toBe(true);
    expect(result.present).toContain("token store");
    expect(result.tokenStorePath).toBe(tokenStorePath);
  });

  it("reports every missing bridge e2e env prerequisite", async () => {
    const result = await checkBridgeE2eEnv({}, async () => false);

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([
      "CHZZK_CLIENT_ID",
      "CHZZK_CLIENT_SECRET",
      "CHZZK_CHANNEL_ID",
      "MINECRAFT_WEBHOOK_SECRET",
      "token store"
    ]);
    expect(result.present).toEqual([]);
  });

  it("reports invalid bridge retry config without printing secrets", async () => {
    const result = await checkBridgeE2eEnv(
      {
        CHZZK_CLIENT_ID: "client",
        CHZZK_CLIENT_SECRET: "client-secret",
        CHZZK_CHANNEL_ID: "channel",
        MINECRAFT_WEBHOOK_SECRET: "webhook-secret",
        CHZZK_TOKEN_STORE: "/tmp/token-store.json",
        WEBHOOK_MAX_ATTEMPTS: "0"
      },
      async () => true
    );

    expect(result.ok).toBe(false);
    expect(result.present).toContain("token store");
    expect(result.invalid).toEqual(["WEBHOOK_MAX_ATTEMPTS must be greater than 0"]);
  });
});
