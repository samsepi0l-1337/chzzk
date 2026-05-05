# Test-First Implementation Contract

## Required Order

1. Write or update `docs/` files.
2. Write tests for the documented behavior.
3. Run tests and confirm they fail for missing production code.
4. Write the minimal implementation code.
5. Run targeted tests.
6. Run full plugin and bridge verification.

Production code must not be written before the corresponding failing test exists.

## Plugin Verification

Targeted commands:

```bash
./gradlew :plugin:test
./gradlew :plugin:shadowJar
```

Required plugin test coverage:

- exact amount mapping
- duplicate event id rejection
- invalid HMAC rejection
- target death count increment and reset
- sidebar line rendering
- simulated kill disables keep inventory for that death event

## Bridge Verification

Targeted commands:

```bash
npm --prefix bridge test
npm --prefix bridge run build
```

Required bridge test coverage:

- CHZZK `payAmount` parsing
- normalized donation payload construction
- HMAC signing of raw JSON
- retry on transient Minecraft webhook failures
- token persistence replacement after refresh

## Manual Smoke Test

1. Install the plugin jar into a Paper/Spigot 1.21.x server.
2. Start the server and confirm webhook startup in logs.
3. Run `/chzzk target set <player>`.
4. Run `/chzzk sidebar on`.
5. Run `/chzzk simulate 1000`, `2000`, `3000`, `5000`, `10000`, `30000`, `50000`, and `100000`.
6. Confirm the sidebar shows all tiers and `Deaths: N`.
7. Start the bridge and send one test donation event through the webhook.
