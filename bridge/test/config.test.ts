import { describe, expect, it } from "vitest";
import { CHZZK_OPENAPI_BASE_URL, loadBridgeAuthConfig, loadBridgeConfig } from "../src/config";

const requiredEnv = {
  CHZZK_CLIENT_ID: "client",
  CHZZK_CLIENT_SECRET: "secret",
  CHZZK_CHANNEL_ID: "target-channel",
  MINECRAFT_WEBHOOK_SECRET: "webhook-secret"
};

describe("loadBridgeConfig", () => {
  it("loads defaults for optional bridge settings", () => {
    const config = loadBridgeConfig(requiredEnv);

    expect(config.chzzk).toEqual({
      clientId: "client",
      clientSecret: "secret",
      targetChannelId: "target-channel",
      baseUrl: CHZZK_OPENAPI_BASE_URL
    });
    expect(config.tokenStorePath).toMatch(/\.chzzk-tokens\.json$/);
    expect(config.minecraftWebhook).toEqual({
      url: "http://127.0.0.1:29371/chzzk/donations",
      healthUrl: "http://127.0.0.1:29371/chzzk/donations/health",
      sharedSecret: "webhook-secret",
      maxAttempts: 3,
      retryDelayMs: 500,
      readinessMaxAttempts: 30,
      readinessRetryDelayMs: 1000
    });
  });

  it("loads explicit optional bridge settings", () => {
    const config = loadBridgeConfig({
      ...requiredEnv,
      CHZZK_OPENAPI_BASE_URL: "https://example.test",
      CHZZK_CHANNEL_ID: " explicit-channel ",
      CHZZK_TOKEN_STORE: "/tmp/token.json",
      MINECRAFT_WEBHOOK_URL: "http://minecraft.test/hook",
      MINECRAFT_WEBHOOK_HEALTH_URL: "http://minecraft.test/ready",
      WEBHOOK_MAX_ATTEMPTS: "5",
      WEBHOOK_RETRY_DELAY_MS: "0",
      WEBHOOK_READY_MAX_ATTEMPTS: "2",
      WEBHOOK_READY_RETRY_DELAY_MS: "0"
    });

    expect(config.chzzk.baseUrl).toBe("https://example.test");
    expect(config.chzzk.targetChannelId).toBe("explicit-channel");
    expect(config.tokenStorePath).toBe("/tmp/token.json");
    expect(config.minecraftWebhook).toMatchObject({
      url: "http://minecraft.test/hook",
      healthUrl: "http://minecraft.test/ready",
      maxAttempts: 5,
      retryDelayMs: 0,
      readinessMaxAttempts: 2,
      readinessRetryDelayMs: 0
    });
  });

  it("rejects missing and blank required values", () => {
    expect(() => loadBridgeConfig({})).toThrow(/CHZZK_CLIENT_ID/);
    expect(() => loadBridgeConfig({
      CHZZK_CLIENT_ID: " ",
      CHZZK_CLIENT_SECRET: "secret",
      MINECRAFT_WEBHOOK_SECRET: "webhook-secret"
    })).toThrow(/CHZZK_CLIENT_ID/);
    expect(() => loadBridgeConfig({
      CHZZK_CLIENT_ID: "client",
      CHZZK_CLIENT_SECRET: "",
      CHZZK_CHANNEL_ID: "target-channel",
      MINECRAFT_WEBHOOK_SECRET: "webhook-secret"
    })).toThrow(/CHZZK_CLIENT_SECRET/);
    expect(() => loadBridgeConfig({
      CHZZK_CLIENT_ID: "client",
      CHZZK_CLIENT_SECRET: "secret",
      CHZZK_CHANNEL_ID: "target-channel"
    })).toThrow(/MINECRAFT_WEBHOOK_SECRET/);
    expect(() => loadBridgeConfig({
      CHZZK_CLIENT_ID: "client",
      CHZZK_CLIENT_SECRET: "secret",
      CHZZK_CHANNEL_ID: " ",
      MINECRAFT_WEBHOOK_SECRET: "webhook-secret"
    })).toThrow(/CHZZK_CHANNEL_ID/);
  });

  it("rejects invalid retry settings", () => {
    expect(() => loadBridgeConfig({
      ...requiredEnv,
      WEBHOOK_MAX_ATTEMPTS: "0"
    })).toThrow(/WEBHOOK_MAX_ATTEMPTS must be greater than 0/);
    expect(() => loadBridgeConfig({
      ...requiredEnv,
      WEBHOOK_MAX_ATTEMPTS: "1.5"
    })).toThrow(/WEBHOOK_MAX_ATTEMPTS must be a non-negative integer/);
    expect(() => loadBridgeConfig({
      ...requiredEnv,
      WEBHOOK_RETRY_DELAY_MS: "-1"
    })).toThrow(/WEBHOOK_RETRY_DELAY_MS must be a non-negative integer/);
    expect(() => loadBridgeConfig({
      ...requiredEnv,
      WEBHOOK_READY_MAX_ATTEMPTS: "0"
    })).toThrow(/WEBHOOK_READY_MAX_ATTEMPTS must be greater than 0/);
    expect(() => loadBridgeConfig({
      ...requiredEnv,
      WEBHOOK_READY_RETRY_DELAY_MS: "-1"
    })).toThrow(/WEBHOOK_READY_RETRY_DELAY_MS must be a non-negative integer/);
    expect(loadBridgeConfig({
      ...requiredEnv,
      WEBHOOK_RETRY_DELAY_MS: ""
    }).minecraftWebhook.retryDelayMs).toBe(500);
  });
});

describe("loadBridgeAuthConfig", () => {
  it("loads auth settings without requiring webhook settings", () => {
    const config = loadBridgeAuthConfig({
      CHZZK_CLIENT_ID: "client",
      CHZZK_CLIENT_SECRET: "secret",
      CHZZK_OPENAPI_BASE_URL: "https://example.test",
      CHZZK_TOKEN_STORE: "/tmp/token.json"
    });

    expect(config).toEqual({
      chzzk: {
        clientId: "client",
        clientSecret: "secret",
        baseUrl: "https://example.test"
      },
      tokenStorePath: "/tmp/token.json"
    });
  });

  it("still rejects missing auth settings", () => {
    expect(() => loadBridgeAuthConfig({})).toThrow(/CHZZK_CLIENT_ID/);
    expect(() => loadBridgeAuthConfig({
      CHZZK_CLIENT_ID: "client"
    })).toThrow(/CHZZK_CLIENT_SECRET/);
  });
});
