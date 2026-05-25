import { loadBridgeAuthConfig } from "./config";
import { loadEnvFile } from "./load-env-file";
import { startAuthWebServer } from "./auth-web-server";

export interface AuthWebCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<Console, "log">;
  loadEnvFile?: typeof loadEnvFile;
  startAuthWebServer?: typeof startAuthWebServer;
  waitUntilStopped?: () => Promise<void>;
}

interface ResolvedAuthWebCliOptions {
  argv: string[];
  env: NodeJS.ProcessEnv;
  stdout: Pick<Console, "log">;
  loadEnvFile: typeof loadEnvFile;
  startAuthWebServer: typeof startAuthWebServer;
  waitUntilStopped: () => Promise<void>;
}

export async function main(options: AuthWebCliOptions = {}): Promise<void> {
  const {
    argv,
    env,
    stdout,
    loadEnvFile: loadEnvFileFn,
    startAuthWebServer: startAuthWebServerFn,
    waitUntilStopped
  } = resolveAuthWebCliOptions(options);
  const envFile = readArg(argv, "--env-file");

  if (envFile) {
    await loadEnvFileFn(envFile, env);
  }

  const config = loadBridgeAuthConfig(env);
  const pageSecret = required(env.CHZZK_AUTH_PAGE_SECRET, "CHZZK_AUTH_PAGE_SECRET");
  const server = await startAuthWebServerFn({
    redirectUri: config.oauth.redirectUri,
    bindHost: config.oauth.callbackBindHost,
    clientId: config.chzzk.clientId,
    clientSecret: config.chzzk.clientSecret,
    pageSecret,
    tokenStorePath: config.tokenStorePath,
    baseUrl: config.chzzk.baseUrl
  });

  stdout.log("CHZZK 스트리머 인증 페이지가 열렸습니다.");
  stdout.log(`접속 URL: ${server.loginUrl}`);
  stdout.log(`CHZZK Developers 로그인 리디렉션 URL: ${config.oauth.redirectUri}`);

  if (argv.includes("--once")) {
    await server.close();
    return;
  }

  await waitUntilStopped();
}

function readArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/* v8 ignore start */
function waitForever(): Promise<void> {
  return new Promise(() => {});
}

function resolveAuthWebCliOptions(options: AuthWebCliOptions): ResolvedAuthWebCliOptions {
  /* v8 ignore start */
  return {
    argv: options.argv ?? process.argv.slice(2),
    env: options.env ?? process.env,
    stdout: options.stdout ?? console,
    loadEnvFile: options.loadEnvFile ?? loadEnvFile,
    startAuthWebServer: options.startAuthWebServer ?? startAuthWebServer,
    waitUntilStopped: options.waitUntilStopped ?? waitForever
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
