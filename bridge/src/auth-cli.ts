import { exchangeAuthorizationCode, refreshAccessToken } from "./chzzk-auth";
import { loadBridgeConfig } from "./config";
import { TokenStore } from "./token-store";

async function main(): Promise<void> {
  const config = loadBridgeConfig();
  const store = new TokenStore(config.tokenStorePath);
  const code = readArg("--code") ?? process.env.CHZZK_AUTH_CODE;
  const state = readArg("--state") ?? process.env.CHZZK_AUTH_STATE;
  const refreshToken = readArg("--refresh-token") ?? process.env.CHZZK_REFRESH_TOKEN;

  if (refreshToken) {
    await store.save(
      await refreshAccessToken({
        clientId: config.chzzk.clientId,
        clientSecret: config.chzzk.clientSecret,
        refreshToken,
        baseUrl: config.chzzk.baseUrl
      })
    );
    return;
  }

  if (!code || !state) {
    throw new Error("Provide --code/--state or CHZZK_REFRESH_TOKEN.");
  }

  await store.save(
    await exchangeAuthorizationCode({
      clientId: config.chzzk.clientId,
      clientSecret: config.chzzk.clientSecret,
      code,
      state,
      baseUrl: config.chzzk.baseUrl
    })
  );
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
