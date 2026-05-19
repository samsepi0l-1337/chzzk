import { checkWebhookHealth } from "./e2e-tools";

export interface E2eHealthCliOptions {
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<Console, "log">;
  stderr?: Pick<Console, "error">;
  fetcher?: typeof fetch;
}

export async function main(options: E2eHealthCliOptions = {}): Promise<void> {
  /* v8 ignore start */
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? console;
  const fetcher = options.fetcher ?? fetch;
  /* v8 ignore stop */
  const result = await checkWebhookHealth(env, fetcher);

  stdout.log(`GET ${result.url}`);
  stdout.log(`status=${result.status}`);
  if (result.body) {
    stdout.log(result.body);
  }

  if (!result.ok) {
    throw new Error(`Webhook health failed: ${result.status}`);
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
