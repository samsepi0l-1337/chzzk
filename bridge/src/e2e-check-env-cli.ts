import { checkBridgeE2eEnv } from "./e2e-tools";

export interface E2eCheckEnvCliOptions {
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<Console, "log">;
}

export async function main(options: E2eCheckEnvCliOptions = {}): Promise<void> {
  /* v8 ignore start */
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? console;
  /* v8 ignore stop */
  const result = await checkBridgeE2eEnv(env);

  stdout.log(`tokenStorePath=${result.tokenStorePath}`);
  for (const name of result.present) {
    stdout.log(`ok=${name}`);
  }
  for (const name of result.missing) {
    stdout.log(`missing=${name}`);
  }
  for (const message of result.invalid) {
    stdout.log(`invalid=${message}`);
  }

  if (!result.ok) {
    throw new Error("E2E environment is not ready");
  }
}

/* v8 ignore start */
if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
/* v8 ignore stop */
