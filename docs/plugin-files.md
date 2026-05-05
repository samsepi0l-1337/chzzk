# Plugin File Map

## Build and Metadata

- `plugin/build.gradle.kts`
  - Builds the Java 21 Bukkit plugin.
  - Depends on Paper API as `compileOnly`.
  - Uses JUnit 5 and MockBukkit for tests.
  - Produces a shaded plugin jar.

- `plugin/src/main/resources/plugin.yml`
  - Declares `ChzzkDonationPlugin`.
  - Uses `api-version: '1.21'`.
  - Registers the `chzzk` command and `chzzkdonation.admin` permission.

- `plugin/src/main/resources/config.yml`
  - Stores webhook host/port/path, shared secret, sidebar default, exact tiers, random pools, TNT behavior, and teleport radius.

## Runtime Entrypoint

- `plugin/src/main/java/dev/samsepiol/chzzk/ChzzkDonationPlugin.java`
  - Creates services on enable.
  - Registers commands and listeners.
  - Starts and stops the webhook server.
  - Reloads configuration safely.

## Commands

- `plugin/src/main/java/dev/samsepiol/chzzk/command/ChzzkCommand.java`
  - Handles `/chzzk target set|clear|status`.
  - Handles `/chzzk sidebar on|off`.
  - Handles `/chzzk deaths reset`.
  - Handles `/chzzk simulate <amount>`.
  - Requires `chzzkdonation.admin`.

## Donation Handling

- `plugin/src/main/java/dev/samsepiol/chzzk/donation/DonationEvent.java`
  - Immutable data object for validated webhook events.

- `plugin/src/main/java/dev/samsepiol/chzzk/donation/DonationTier.java`
  - Maps exact amounts to effect kinds.

- `plugin/src/main/java/dev/samsepiol/chzzk/donation/DonationService.java`
  - Rejects duplicate event ids.
  - Maps amount to tier.
  - Runs the tier effect on the Bukkit main thread.

## Effects

- `plugin/src/main/java/dev/samsepiol/chzzk/effect/DonationEffectExecutor.java`
  - Executes all gameplay effects.
  - Resolves target player from `TargetService`.
  - Applies buffs, items, mobs, TNT, teleport, and kill behavior.

- `plugin/src/main/java/dev/samsepiol/chzzk/effect/RandomPools.java`
  - Loads configured random buff, item, mob, and combat mob pools.
  - Provides deterministic pool parsing for tests.

## State

- `plugin/src/main/java/dev/samsepiol/chzzk/state/PluginStateStore.java`
  - Persists target UUID/name, sidebar setting, death count, and recent event ids.

- `plugin/src/main/java/dev/samsepiol/chzzk/state/TargetService.java`
  - Owns configured target player state.
  - Resolves online target player.

- `plugin/src/main/java/dev/samsepiol/chzzk/state/DeathCountService.java`
  - Increments target death count.
  - Resets and persists death count.

## Display

- `plugin/src/main/java/dev/samsepiol/chzzk/display/SidebarService.java`
  - Creates and updates the target player's scoreboard sidebar.
  - Shows amount/effect tiers and `Deaths: N`.
  - Clears the scoreboard when disabled or target changes.

- `plugin/src/main/java/dev/samsepiol/chzzk/display/SidebarLines.java`
  - Builds deterministic sidebar text lines.
  - Keeps formatting testable without a running Minecraft server.

## Events

- `plugin/src/main/java/dev/samsepiol/chzzk/listener/TargetDeathListener.java`
  - Listens to `PlayerDeathEvent`.
  - Increments count only when the dead player is the configured target.
  - Forces keep-inventory off for plugin-triggered kill events.

## Webhook

- `plugin/src/main/java/dev/samsepiol/chzzk/webhook/DonationWebhookServer.java`
  - Runs a local HTTP server.
  - Accepts `POST /chzzk/donations`.
  - Verifies HMAC.
  - Parses JSON into `DonationEvent`.

- `plugin/src/main/java/dev/samsepiol/chzzk/webhook/HmacVerifier.java`
  - Validates `X-Chzzk-Signature`.
  - Uses constant-time comparison.

## Tests

- `plugin/src/test/java/dev/samsepiol/chzzk/donation/DonationServiceTest.java`
  - Exact amount mapping, duplicate rejection, unknown amount handling.

- `plugin/src/test/java/dev/samsepiol/chzzk/webhook/HmacVerifierTest.java`
  - Signature acceptance and rejection.

- `plugin/src/test/java/dev/samsepiol/chzzk/state/DeathCountServiceTest.java`
  - Target-only death count behavior and reset.

- `plugin/src/test/java/dev/samsepiol/chzzk/display/SidebarServiceTest.java`
  - Sidebar contains all tiers and death count.
