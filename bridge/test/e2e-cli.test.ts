import { describe, expect, it, vi } from "vitest";
import { main as checkEnvMain } from "../src/e2e-check-env-cli";
import { main as healthMain } from "../src/e2e-health-cli";
import { main as webhookMain } from "../src/e2e-webhook-cli";

describe("e2e cli commands", () => {
  it("prints webhook health status", async () => {
    const logs: string[] = [];

    await healthMain({
      env: {
        MINECRAFT_WEBHOOK_HEALTH_URL: "http://paper:29371/ready"
      },
      stdout: {
        log: (value: string) => logs.push(value)
      },
      fetcher: async () => new Response("{\"status\":\"ok\"}", { status: 200 })
    });

    expect(logs).toEqual([
      "GET http://paper:29371/ready",
      "status=200",
      "{\"status\":\"ok\"}"
    ]);
  });

  it("fails webhook health when the plugin endpoint is not ready", async () => {
    const logs: string[] = [];

    await expect(
      healthMain({
        env: {},
        stdout: {
          log: (value: string) => logs.push(value)
        },
        fetcher: async () => new Response("", { status: 503 })
      })
    ).rejects.toThrow(/Webhook health failed: 503/);

    expect(logs).toEqual([
      "GET http://127.0.0.1:29371/chzzk/donations/health",
      "status=503"
    ]);
  });

  it("prints signed webhook POST result", async () => {
    const logs: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{\"status\":\"ACCEPTED\"}", { status: 202 })
    );

    await webhookMain({
      argv: ["--amount", "1000", "--event-id", "e2e-fixed"],
      env: {
        MINECRAFT_WEBHOOK_SECRET: "shared-secret"
      },
      stdout: {
        log: (value: string) => logs.push(value)
      },
      fetcher
    });

    expect(logs).toEqual([
      "POST http://127.0.0.1:29371/chzzk/donations",
      "eventId=e2e-fixed",
      "amount=1000",
      "status=202",
      "{\"status\":\"ACCEPTED\"}"
    ]);
  });

  it("fails signed webhook POST on non-2xx plugin responses", async () => {
    const logs: string[] = [];

    await expect(
      webhookMain({
        argv: ["--amount", "1000", "--event-id", "e2e-fixed"],
        env: {
          MINECRAFT_WEBHOOK_SECRET: "shared-secret"
        },
        stdout: {
          log: (value: string) => logs.push(value)
        },
        fetcher: async () => new Response("", { status: 401 })
      })
    ).rejects.toThrow(/Webhook POST failed: 401/);

    expect(logs).toEqual([
      "POST http://127.0.0.1:29371/chzzk/donations",
      "eventId=e2e-fixed",
      "amount=1000",
      "status=401"
    ]);
  });

  it("prints bridge readiness without secret values", async () => {
    const logs: string[] = [];

    await checkEnvMain({
      env: {
        CHZZK_CLIENT_ID: "client",
        CHZZK_CLIENT_SECRET: "client-secret",
        CHZZK_CHANNEL_ID: "channel",
        MINECRAFT_WEBHOOK_SECRET: "webhook-secret",
        CHZZK_REFRESH_TOKEN: "refresh-token"
      },
      stdout: {
        log: (value: string) => logs.push(value)
      }
    });

    expect(logs).toContain("ok=CHZZK_CLIENT_SECRET");
    expect(logs).toContain("ok=MINECRAFT_WEBHOOK_SECRET");
    expect(logs).toContain("ok=CHZZK_REFRESH_TOKEN");
    expect(logs.join("\n")).not.toContain("client-secret");
    expect(logs.join("\n")).not.toContain("webhook-secret");
    expect(logs.join("\n")).not.toContain("refresh-token");
  });

  it("fails bridge readiness when required env is missing", async () => {
    const logs: string[] = [];

    await expect(
      checkEnvMain({
        env: {},
        stdout: {
          log: (value: string) => logs.push(value)
        }
      })
    ).rejects.toThrow(/E2E environment is not ready/);

    expect(logs).toContain("missing=CHZZK_CLIENT_ID");
    expect(logs).toContain("missing=CHZZK_REFRESH_TOKEN or token store");
  });

  it("prints invalid bridge readiness settings", async () => {
    const logs: string[] = [];

    await expect(
      checkEnvMain({
        env: {
          CHZZK_CLIENT_ID: "client",
          CHZZK_CLIENT_SECRET: "client-secret",
          CHZZK_CHANNEL_ID: "channel",
          MINECRAFT_WEBHOOK_SECRET: "webhook-secret",
          CHZZK_REFRESH_TOKEN: "refresh-token",
          WEBHOOK_MAX_ATTEMPTS: "0"
        },
        stdout: {
          log: (value: string) => logs.push(value)
        }
      })
    ).rejects.toThrow(/E2E environment is not ready/);

    expect(logs).toContain("invalid=WEBHOOK_MAX_ATTEMPTS must be greater than 0");
    expect(logs.join("\n")).not.toContain("refresh-token");
  });
});
