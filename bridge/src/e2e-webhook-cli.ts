import { parseWebhookArgs, sendSignedWebhookDonation } from "./e2e-tools";

export interface E2eWebhookCliOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<Console, "log">;
  fetcher?: typeof fetch;
}

export async function main(options: E2eWebhookCliOptions = {}): Promise<void> {
  /* v8 ignore start */
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? console;
  const fetcher = options.fetcher ?? fetch;
  /* v8 ignore stop */
  const webhookOptions = parseWebhookArgs(argv, { env });
  const result = await sendSignedWebhookDonation(webhookOptions, env, fetcher);

  stdout.log(`POST ${webhookOptions.webhookUrl}`);
  stdout.log(`eventId=${webhookOptions.eventId}`);
  stdout.log(`amount=${webhookOptions.amount}`);
  stdout.log(`status=${result.status}`);
  if (result.body) {
    stdout.log(result.body);
  }

  if (!result.ok) {
    throw new Error(`Webhook POST failed: ${result.status}`);
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
