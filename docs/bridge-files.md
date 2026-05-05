# Bridge File Map

## Build and Metadata

- `bridge/package.json`
  - Defines scripts: `auth`, `start`, `test`, `build`.
  - Uses TypeScript, Vitest, Socket.IO client, and Undici.

- `bridge/tsconfig.json`
  - Compiles ESM TypeScript into `dist/`.

- `bridge/.env.example`
  - Documents required environment variables without secrets.

## Entrypoints

- `bridge/src/index.ts`
  - Loads config.
  - Loads stored tokens.
  - Refreshes tokens when needed.
  - Creates a CHZZK session subscription.
  - Forwards donation events to Minecraft.

- `bridge/src/auth-cli.ts`
  - Starts OAuth authorization.
  - Exchanges authorization code for tokens.
  - Stores tokens locally.

## Configuration

- `bridge/src/config.ts`
  - Reads required environment variables.
  - Validates webhook URL and shared secret.

- `bridge/src/token-store.ts`
  - Reads and writes token JSON under `.chzzk/tokens.json`.
  - Keeps token files out of git.

## CHZZK

- `bridge/src/chzzk-auth.ts`
  - Exchanges authorization code.
  - Refreshes access tokens.

- `bridge/src/chzzk-session.ts`
  - Calls CHZZK Session API.
  - Connects Socket.IO to the session URL.
  - Emits normalized donation payloads.

- `bridge/src/donation-parser.ts`
  - Converts CHZZK donation events into the shared webhook payload.
  - Parses `payAmount` into an integer amount.

## Minecraft Delivery

- `bridge/src/webhook-client.ts`
  - Signs raw JSON with HMAC SHA-256.
  - Sends POST requests to the plugin.
  - Retries transient failures.

## Tests

- `bridge/test/donation-parser.test.ts`
  - Validates `payAmount` parsing and normalized payload shape.

- `bridge/test/webhook-client.test.ts`
  - Validates HMAC signature generation and retry behavior.

- `bridge/test/token-store.test.ts`
  - Validates token persistence and refresh replacement behavior.
