import { afterEach, describe, expect, test, vi } from "vitest";
import type { BridgeConfig } from "../src/config";
import type { StoredToken } from "../src/token-store";
import { loadStoredOrBootstrapToken, runBridge } from "../src/index";

const baseConfig: BridgeConfig = {
  chzzk: {
    clientId: "client-id",
    clientSecret: "client-secret",
    targetChannelId: "target-channel",
    baseUrl: "https://openapi.test"
  },
  tokenStorePath: "/tmp/.chzzk-tokens.json",
  minecraftWebhook: {
    url: "http://paper:29371/chzzk/donations",
    healthUrl: "http://paper:29371/chzzk/donations/health",
    sharedSecret: "shared-secret",
    maxAttempts: 3,
    retryDelayMs: 500,
    readinessMaxAttempts: 30,
    readinessRetryDelayMs: 1000
  }
};

const storedToken: StoredToken = {
  accessToken: "stored-access",
  refreshToken: "stored-refresh",
  tokenType: "Bearer",
  expiresAt: "2026-05-06T00:00:00.000Z",
  scope: "donation"
};

const refreshedToken: StoredToken = {
  accessToken: "refreshed-access",
  refreshToken: "refreshed-refresh",
  tokenType: "Bearer",
  expiresAt: "2026-05-06T01:00:00.000Z",
  scope: "donation"
};

function createTokenStore(token: StoredToken | null) {
  return {
    load: vi.fn<() => Promise<StoredToken | null>>().mockResolvedValue(token),
    save: vi.fn<(nextToken: StoredToken) => Promise<void>>().mockResolvedValue()
  };
}

describe("loadStoredOrBootstrapToken", () => {
  test("fails with the existing auth guidance when no token store and no refresh token exist", async () => {
    const tokenStore = createTokenStore(null);
    const refresh = vi.fn();

    await expect(
      loadStoredOrBootstrapToken(baseConfig, tokenStore, {}, refresh)
    ).rejects.toThrow("No CHZZK token found. Run npm run build && npm run auth first.");
    expect(refresh).not.toHaveBeenCalled();
    expect(tokenStore.save).not.toHaveBeenCalled();
  });

  test("bootstraps and saves a missing token store from CHZZK_REFRESH_TOKEN", async () => {
    const tokenStore = createTokenStore(null);
    const refresh = vi.fn().mockResolvedValue(refreshedToken);

    await expect(
      loadStoredOrBootstrapToken(
        baseConfig,
        tokenStore,
        { CHZZK_REFRESH_TOKEN: "env-refresh-token" },
        refresh
      )
    ).resolves.toEqual(refreshedToken);

    expect(refresh).toHaveBeenCalledWith({
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "env-refresh-token",
      baseUrl: "https://openapi.test"
    });
    expect(tokenStore.save).toHaveBeenCalledWith(refreshedToken);
  });
});

describe("runBridge", () => {
  test("starts a live session after bootstrapping a missing token store", async () => {
    const tokenStore = createTokenStore(null);
    const refresh = vi.fn().mockResolvedValue(refreshedToken);
    const waitForWebhookReady = vi.fn().mockResolvedValue(undefined);
    const webhookClient = { sendDonation: vi.fn() };
    const createWebhookClient = vi.fn().mockReturnValue(webhookClient);
    const startSession = vi.fn().mockResolvedValue(undefined);

    await runBridge(
      baseConfig,
      {
        tokenStore,
        refreshAccessToken: refresh,
        waitForWebhookReady,
        createWebhookClient,
        startChzzkDonationSession: startSession
      },
      { CHZZK_REFRESH_TOKEN: "env-refresh-token" }
    );

    expect(tokenStore.save).toHaveBeenCalledWith(refreshedToken);
    expect(waitForWebhookReady).toHaveBeenCalledWith(baseConfig.minecraftWebhook);
    expect(createWebhookClient).toHaveBeenCalledWith(baseConfig.minecraftWebhook);
    expect(startSession).toHaveBeenCalledWith(
      {
        accessToken: "refreshed-access",
        baseUrl: "https://openapi.test",
        targetChannelId: "target-channel"
      },
      webhookClient
    );
  });

  test("starts a live session from an existing token store without env bootstrap", async () => {
    const tokenStore = createTokenStore(storedToken);
    const refresh = vi.fn().mockResolvedValue(refreshedToken);
    const waitForWebhookReady = vi.fn().mockResolvedValue(undefined);
    const webhookClient = { sendDonation: vi.fn() };
    const createWebhookClient = vi.fn().mockReturnValue(webhookClient);
    const startSession = vi.fn().mockResolvedValue(undefined);

    await runBridge(
      baseConfig,
      {
        tokenStore,
        refreshAccessToken: refresh,
        waitForWebhookReady,
        createWebhookClient,
        startChzzkDonationSession: startSession
      },
      { CHZZK_REFRESH_TOKEN: "env-refresh-token" }
    );

    expect(refresh).toHaveBeenCalledWith({
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "stored-refresh",
      baseUrl: "https://openapi.test"
    });
    expect(tokenStore.save).toHaveBeenCalledWith(refreshedToken);
    expect(startSession).toHaveBeenCalledWith(
      {
        accessToken: "refreshed-access",
        baseUrl: "https://openapi.test",
        targetChannelId: "target-channel"
      },
      webhookClient
    );
  });
});

describe("main", () => {
  afterEach(() => {
    vi.doUnmock("../src/config");
    vi.doUnmock("../src/chzzk-auth");
    vi.doUnmock("../src/token-store");
    vi.doUnmock("../src/webhook-client");
    vi.doUnmock("../src/chzzk-session");
  });

  test("loads config and wires the production bridge dependencies", async () => {
    vi.resetModules();

    const env = { CHZZK_REFRESH_TOKEN: "env-refresh-token" };
    const loadBridgeConfig = vi.fn().mockReturnValue(baseConfig);
    const refreshAccessToken = vi.fn().mockResolvedValue(refreshedToken);
    const tokenStore = createTokenStore(storedToken);
    const TokenStore = vi.fn(function TokenStore() {
      return tokenStore;
    });
    const waitForWebhookReady = vi.fn().mockResolvedValue(undefined);
    const webhookClient = { sendDonation: vi.fn() };
    const MinecraftWebhookClient = vi.fn(function MinecraftWebhookClient() {
      return webhookClient;
    });
    const startChzzkDonationSession = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../src/config", async () => ({
      ...(await vi.importActual<typeof import("../src/config")>("../src/config")),
      loadBridgeConfig
    }));
    vi.doMock("../src/chzzk-auth", async () => ({
      ...(await vi.importActual<typeof import("../src/chzzk-auth")>("../src/chzzk-auth")),
      refreshAccessToken
    }));
    vi.doMock("../src/token-store", async () => ({
      ...(await vi.importActual<typeof import("../src/token-store")>("../src/token-store")),
      TokenStore
    }));
    vi.doMock("../src/webhook-client", async () => ({
      ...(await vi.importActual<typeof import("../src/webhook-client")>("../src/webhook-client")),
      MinecraftWebhookClient,
      waitForWebhookReady
    }));
    vi.doMock("../src/chzzk-session", async () => ({
      ...(await vi.importActual<typeof import("../src/chzzk-session")>("../src/chzzk-session")),
      startChzzkDonationSession
    }));

    const { main } = await import("../src/index");

    await main(env);

    expect(loadBridgeConfig).toHaveBeenCalledWith(env);
    expect(TokenStore).toHaveBeenCalledWith("/tmp/.chzzk-tokens.json");
    expect(refreshAccessToken).toHaveBeenCalledWith({
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "stored-refresh",
      baseUrl: "https://openapi.test"
    });
    expect(tokenStore.save).toHaveBeenCalledWith(refreshedToken);
    expect(waitForWebhookReady).toHaveBeenCalledWith(baseConfig.minecraftWebhook);
    expect(MinecraftWebhookClient).toHaveBeenCalledWith(baseConfig.minecraftWebhook);
    expect(startChzzkDonationSession).toHaveBeenCalledWith(
      {
        accessToken: "refreshed-access",
        baseUrl: "https://openapi.test",
        targetChannelId: "target-channel"
      },
      webhookClient
    );
  });
});
