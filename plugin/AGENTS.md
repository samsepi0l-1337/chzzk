# plugin/AGENTS.md

## Domain

- Paper plugin code, `/chzzk` commands, webhook receiver, donation routing, effects, sidebar, persistent state, and runtime config live here.
- Canonical docs before edits: `docs/plugin/commands.md`, `docs/plugin/state-and-config.md`, `docs/plugin/effects-and-donation.md`, `docs/bridge/webhook-protocol.md`, `docs/testing/coverage-and-runbook.md`.

## Must Know

- Runtime is Paper 1.21.1 / Java 21; keep `plugin/build.gradle.kts` and Docker Paper version aligned.
- `plugin/src/main/resources/config.yml` is only the packaged default. Docker writes the real runtime `plugins/ChzzkDonation/config.yml` from `MINECRAFT_WEBHOOK_SECRET`.
- The effect target is set in game with `/chzzk target set <player>`, not by editing `config.yml`.
- Donation effects only run when `payAmount` exactly matches a tier: 1000, 2000, 3000, 5000, 10000, 30000, 50000, 100000.
- Bukkit/Paper API side effects must run on the Minecraft main thread.
- Paper 1.21.1 has `DisplaySlot.SIDEBAR`; do not use nonexistent left-side scoreboard slots.

## Failure Knowledge

- If webhook signature fails, do not edit packaged defaults first; compare runtime `MINECRAFT_WEBHOOK_SECRET` and `plugins/ChzzkDonation/config.yml`.
- If duplicate official donations leak through with new bridge event ids, do not promise upstream dedupe; state plugin dedupe is webhook `eventId`-scoped.
- If random teleport lands unsafe, do not expand search blindly; reject unsafe blocks and retry within X/Z +/-1000.
- If sidebar line numbers show, do not change slots; preserve `DisplaySlot.SIDEBAR` and blank number formats.
- If effects run off-thread, do not call Bukkit APIs directly; schedule onto the main thread.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `./gradlew check shadowJar` for plugin changes.
- Keep JaCoCo line and branch coverage at 100%.
- Use `/chzzk simulate <tier amount>` for plugin-only runtime smoke after setting a target.

## Session Close Rule

- At the end of every session touching `plugin/`, review this file and add newly proven domain failure knowledge or required gameplay/runtime facts here, separate from any `docs/` update.
- Do not add secrets or unverified assumptions from local manual tests.
