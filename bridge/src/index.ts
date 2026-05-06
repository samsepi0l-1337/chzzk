import { loadBridgeConfig } from "./config";
import { refreshAccessToken } from "./chzzk-auth";
import { TokenStore } from "./token-store";
import { MinecraftWebhookClient, waitForWebhookReady } from "./webhook-client";
import { startChzzkDonationSession } from "./chzzk-session";
import type { BridgeConfig } from "./config";
import type { ChzzkRefreshConfig } from "./chzzk-auth";
import type { StoredToken } from "./token-store";

const missingTokenMessage = "No CHZZK token found. Run npm run build && npm run auth first.";

type RefreshToken = (config: ChzzkRefreshConfig) => Promise<StoredToken>;
type WebhookClient = Parameters<typeof startChzzkDonationSession>[1];

interface TokenStorePort {
  load(): Promise<StoredToken | null>;
  save(token: StoredToken): Promise<void>;
}

interface BridgeDependencies {
  tokenStore: TokenStorePort;
  refreshAccessToken: RefreshToken;
  waitForWebhookReady: typeof waitForWebhookReady;
  createWebhookClient(config: BridgeConfig["minecraftWebhook"]): WebhookClient;
  startChzzkDonationSession: typeof startChzzkDonationSession;
}

export async function loadStoredOrBootstrapToken(
  config: BridgeConfig,
  tokenStore: TokenStorePort,
  env: NodeJS.ProcessEnv = process.env,
  refreshToken: RefreshToken = refreshAccessToken
): Promise<StoredToken> {
  const storedToken = await tokenStore.load();
  const refreshTokenValue = storedToken?.refreshToken ?? env.CHZZK_REFRESH_TOKEN?.trim();
  if (!refreshTokenValue) {
    throw new Error(missingTokenMessage);
  }

  const token = await refreshToken({
    clientId: config.chzzk.clientId,
    clientSecret: config.chzzk.clientSecret,
    refreshToken: refreshTokenValue,
    baseUrl: config.chzzk.baseUrl
  });
  await tokenStore.save(token);
  return token;
}

export async function runBridge(
  config: BridgeConfig,
  dependencies: BridgeDependencies,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const token = await loadStoredOrBootstrapToken(
    config,
    dependencies.tokenStore,
    env,
    dependencies.refreshAccessToken
  );

  await dependencies.waitForWebhookReady(config.minecraftWebhook);
  const webhookClient = dependencies.createWebhookClient(config.minecraftWebhook);
  await dependencies.startChzzkDonationSession(
    {
      accessToken: token.accessToken,
      baseUrl: config.chzzk.baseUrl
    },
    webhookClient
  );
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = loadBridgeConfig(env);
  await runBridge(
    config,
    {
      tokenStore: new TokenStore(config.tokenStorePath),
      refreshAccessToken,
      waitForWebhookReady,
      createWebhookClient: (webhookConfig) => new MinecraftWebhookClient(webhookConfig),
      startChzzkDonationSession
    },
    env
  );
}

/* v8 ignore start */
if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
/* v8 ignore stop */
