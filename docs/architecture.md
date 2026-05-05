# CHZZK Donation Minecraft Integration

## Goal

Build a local CHZZK donation integration for a Minecraft 1.21.x server.
The first version consists of:

- a Paper/Spigot-compatible Bukkit plugin under `plugin/`
- a Node.js TypeScript CHZZK bridge under `bridge/`
- local HMAC-signed webhook delivery from the bridge to the plugin

The implementation order is documentation first, tests second, production code third.

## Areas

### Plugin

The plugin owns all Minecraft behavior. It exposes administrator commands, stores the target player and death count, verifies local webhook requests, maps exact donation amounts to effects, and renders the scoreboard sidebar.

The plugin must avoid Paper-only APIs in v1. Use the Bukkit/Spigot API surface and a classic `plugin.yml`.

### Bridge

The bridge owns CHZZK OAuth, token persistence, Session API connection, donation payload parsing, webhook signing, retry, and process logging.

The bridge runs as a separate Node.js process on the same host as the Minecraft server. It sends webhook requests only to the configured local plugin URL.

### Shared Contract

The bridge sends donation events to:

```text
POST http://127.0.0.1:29371/chzzk/donations
X-Chzzk-Signature: sha256=<hex>
Content-Type: application/json
```

Payload:

```json
{
  "eventId": "string",
  "amount": 1000,
  "donatorNickname": "string",
  "message": "string",
  "receivedAt": "2026-05-05T00:00:00.000Z"
}
```

The HMAC message is the raw JSON request body. The plugin verifies it with the shared secret from config.

## Donation Rules

Amounts must match exactly.

| Amount | Effect |
| ---: | --- |
| 1000 | Random positive buff |
| 2000 | Random item x1 |
| 3000 | Random mob x1 |
| 5000 | Combat mob x1 |
| 10000 | Combat mob x3 |
| 30000 | Primed TNT |
| 50000 | Random safe teleport |
| 100000 | Kill target, no inventory save |

Unknown amounts are ignored and logged.

## Display Rules

The plugin renders a Bukkit scoreboard sidebar to the configured target player by default.

The sidebar shows:

- title: `CHZZK 후원`
- all amount/effect tiers
- `Deaths: N`

Death count is the target player's total deaths while this plugin is active and targeted. It is persisted to disk and can be reset by command.

## Failure Rules

- Missing target player: log and skip the effect.
- Offline target player: log and skip the effect.
- Invalid HMAC: return `401`.
- Duplicate `eventId`: return `409`.
- Unknown amount: return `202` with ignored status.
- Effect execution failure: log the exception and return `500`.
