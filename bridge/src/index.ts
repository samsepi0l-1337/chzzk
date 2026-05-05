import { loadBridgeConfig } from "./config";
import { refreshAccessToken } from "./chzzk-auth";
import { TokenStore } from "./token-store";
import { MinecraftWebhookClient } from "./webhook-client";
import { startChzzkDonationSession } from "./chzzk-session";

async function main(): Promise<void> {
  const config = loadBridgeConfig();
  const tokenStore = new TokenStore(config.tokenStorePath);
  const storedToken = await tokenStore.load();
  if (!storedToken) {
    throw new Error("No CHZZK token found. Run npm run build && npm run auth first.");
  }

  const token = await refreshAccessToken({
    clientId: config.chzzk.clientId,
    clientSecret: config.chzzk.clientSecret,
    refreshToken: storedToken.refreshToken,
    baseUrl: config.chzzk.baseUrl
  });
  await tokenStore.save(token);

  const webhookClient = new MinecraftWebhookClient(config.minecraftWebhook);
  await startChzzkDonationSession(
    {
      accessToken: token.accessToken,
      baseUrl: config.chzzk.baseUrl
    },
    webhookClient
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
