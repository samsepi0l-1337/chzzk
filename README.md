# CHZZK Donation Minecraft

Paper 1.21.8 plugin and CHZZK OpenAPI bridge for triggering Minecraft effects from donation events.

## Local Docker

Copy the environment template and fill CHZZK credentials plus a non-empty webhook secret:

```bash
cp .env.example .env
```

Set `EULA=true` only after accepting the Minecraft EULA. Then build and run:

```bash
docker compose -f docker-compose.yml up --build
```

Before starting the live session, store a CHZZK refresh token or OAuth code:

```bash
docker compose -f docker-compose.yml run --rm bridge npm run auth -- --refresh-token "$CHZZK_REFRESH_TOKEN"
```

The bridge sends donations to `http://paper:29371/chzzk/donations`. The Paper plugin writes its config from `MINECRAFT_WEBHOOK_SECRET` so both services share the same HMAC secret. Only `25565` is published to the host; `29371` stays inside the Docker network.

## Verification

```bash
npm --prefix bridge run coverage
npm --prefix bridge run build
./gradlew check shadowJar
```

`socket.io-client` is pinned to `2.0.3` because CHZZK Session currently documents support up to that version. This leaves known transitive npm audit findings, so keep the bridge isolated and run a live CHZZK session smoke test before production.

## Socket.IO Compatibility

This bridge uses only the shared 2.x/4.x client surface:

- `io(url, options)`
- `reconnection`, `forceNew`, `timeout`, `transports`
- `socket.on(...)` for `SYSTEM`, `DONATION`, `message`, `connect_error`, and `disconnect`

The major differences are outside that surface: 3.x/4.x changed the low-level protocol, moved to built-in TypeScript types and named ESM imports, and added newer client options such as `auth`, `retries`, and `ackTimeout`. CHZZK documents Socket.IO-client support only through `2.0.3`, so the bridge uses a small local type declaration for that older client.
