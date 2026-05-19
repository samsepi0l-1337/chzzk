import { buildAuthorizationUrl, createOAuthState } from "./chzzk-oauth";
import { loadBridgeAuthConfig } from "./config";
import { exchangeAuthorizationCode } from "./chzzk-auth";
import { loadEnvFile } from "./load-env-file";
import { startOAuthCallbackServer } from "./oauth-callback-server";
import { TokenStore } from "./token-store";
import type { StoredToken } from "./token-store";

export interface AuthLoginCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<Console, "log">;
  createOAuthState?: () => string;
  loadEnvFile?: typeof loadEnvFile;
  startOAuthCallbackServer?: typeof startOAuthCallbackServer;
  exchangeAuthorizationCode?: typeof exchangeAuthorizationCode;
  createTokenStore?: (path: string) => TokenStorePort;
}

interface TokenStorePort {
  save(token: StoredToken): Promise<void>;
}

interface ResolvedAuthLoginCliOptions {
  env: NodeJS.ProcessEnv;
  argv: string[];
  stdout: Pick<Console, "log">;
  createOAuthState: () => string;
  loadEnvFile: typeof loadEnvFile;
  startOAuthCallbackServer: typeof startOAuthCallbackServer;
  exchangeAuthorizationCode: typeof exchangeAuthorizationCode;
  createTokenStore: (path: string) => TokenStorePort;
}

export async function main(options: AuthLoginCliOptions = {}): Promise<void> {
  const {
    env,
    argv,
    stdout,
    createOAuthState: createOAuthStateFn,
    loadEnvFile: loadEnvFileFn,
    startOAuthCallbackServer: startOAuthCallbackServerFn,
    exchangeAuthorizationCode: exchangeAuthorizationCodeFn,
    createTokenStore: createTokenStoreFn
  } = resolveAuthLoginCliOptions(options);
  const envFile = readArg(argv, "--env-file");

  if (envFile) {
    await loadEnvFileFn(envFile, env);
  }

  const config = loadBridgeAuthConfig(env);
  const state = createOAuthStateFn();
  const authorizationUrl = buildAuthorizationUrl({
    clientId: config.chzzk.clientId,
    redirectUri: config.oauth.redirectUri,
    state
  });
  const callbackPromise = startOAuthCallbackServerFn({
    redirectUri: config.oauth.redirectUri,
    expectedState: state
  });

  stdout.log("브라우저에서 아래 URL로 CHZZK 로그인을 진행하세요.");
  stdout.log(authorizationUrl);
  stdout.log(`state=${state}`);
  stdout.log(`CHZZK Developers에 같은 redirectUri를 등록하세요: ${config.oauth.redirectUri}`);

  const callback = await callbackPromise;
  const token = await exchangeAuthorizationCodeFn({
    clientId: config.chzzk.clientId,
    clientSecret: config.chzzk.clientSecret,
    code: callback.code,
    state: callback.state,
    baseUrl: config.chzzk.baseUrl
  });
  await createTokenStoreFn(config.tokenStorePath).save(token);
  stdout.log(`토큰 저장 완료: ${config.tokenStorePath}`);
}

function readArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function resolveAuthLoginCliOptions(options: AuthLoginCliOptions): ResolvedAuthLoginCliOptions {
  /* v8 ignore start */
  return {
    env: options.env ?? process.env,
    argv: options.argv ?? process.argv.slice(2),
    stdout: options.stdout ?? console,
    createOAuthState: options.createOAuthState ?? createOAuthState,
    loadEnvFile: options.loadEnvFile ?? loadEnvFile,
    startOAuthCallbackServer: options.startOAuthCallbackServer ?? startOAuthCallbackServer,
    exchangeAuthorizationCode: options.exchangeAuthorizationCode ?? exchangeAuthorizationCode,
    createTokenStore: options.createTokenStore ?? ((path: string) => new TokenStore(path))
  };
  /* v8 ignore stop */
}

/* v8 ignore start */
if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
/* v8 ignore stop */
