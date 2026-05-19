import { buildAuthorizationUrl, createOAuthState } from "./chzzk-oauth";
import { loadBridgeAuthConfig } from "./config";
import { loadEnvFile } from "./load-env-file";

export interface AuthUrlCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<Console, "log">;
  createOAuthState?: () => string;
  loadEnvFile?: typeof loadEnvFile;
}

interface ResolvedAuthUrlCliOptions {
  env: NodeJS.ProcessEnv;
  argv: string[];
  stdout: Pick<Console, "log">;
  createOAuthState: () => string;
  loadEnvFile: typeof loadEnvFile;
}

export async function main(options: AuthUrlCliOptions = {}): Promise<void> {
  const { env, argv, stdout, createOAuthState: createOAuthStateFn, loadEnvFile: loadEnvFileFn } =
    resolveAuthUrlCliOptions(options);
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

  stdout.log(authorizationUrl);
  stdout.log(`state=${state}`);
  stdout.log(`CHZZK Developers에 같은 redirectUri를 등록하세요: ${config.oauth.redirectUri}`);
}

function readArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function resolveAuthUrlCliOptions(options: AuthUrlCliOptions): ResolvedAuthUrlCliOptions {
  /* v8 ignore start */
  return {
    env: options.env ?? process.env,
    argv: options.argv ?? process.argv.slice(2),
    stdout: options.stdout ?? console,
    createOAuthState: options.createOAuthState ?? createOAuthState,
    loadEnvFile: options.loadEnvFile ?? loadEnvFile
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
