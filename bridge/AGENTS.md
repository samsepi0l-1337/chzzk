# bridge/AGENTS.md

## Domain

- CHZZK OpenAPI/OAuth, token store, Session Socket.IO, donation parsing, and signed webhook delivery live here.
- Canonical docs before edits: `docs/bridge/chzzk-auth-and-session.md`, `docs/bridge/webhook-protocol.md`, `docs/infra/env-reference.md`, `docs/testing/coverage-and-runbook.md`.

## Must Know

- `bridge` does not auto-load `.env`; local non-Docker runs need process env or `auth:* -- --env-file`.
- Docker injects `CHZZK_TOKEN_STORE=/data/.chzzk-tokens.json` and `MINECRAFT_WEBHOOK_URL=http://paper:29371/chzzk/donations`.
- `CHZZK_CHANNEL_ID` is required for live session filtering; subscription identity comes from OAuth/token account.
- Token bootstrap needs an existing token store or `auth:login`; do not log token values.
- CHZZK donation backfill is unsupported; only realtime Session `DONATION` is handled.
- Chat test command `!치지직마크 <amount>` is realtime Session `CHAT` only and requires `채팅 메시지 조회` OAuth scope.
- Bridge-generated webhook `eventId` cannot dedupe upstream redelivery of the same official donation.

## Failure Knowledge

- If Docker compose env interpolation fails, do not debug bridge code first; validate root `.env` required values.
- If bridge-only auth needs env, do not add dotenv autoload; use process env or `auth:* -- --env-file`.
- If Socket.IO crashes in Docker/Node, do not change CHZZK protocol handling first; preserve `forceNode: true` and inspect transport/runtime.
- If signature verification fails, do not resend blindly; compare bridge `MINECRAFT_WEBHOOK_SECRET` with plugin runtime `webhook.shared-secret`.
- If non-target donations or chat tests appear, do not widen delivery; drop missing or mismatched `channelId` before webhook delivery.
- If chat tests do not arrive, do not debug Minecraft effects first; inspect chat subscription scope/logs.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `npm --prefix bridge run coverage` for changes under `bridge/src` or `bridge/test`; coverage must stay 100%.
- Run `npm --prefix bridge run build` after TypeScript changes.
- Docker/env changes also need compose config checks from the root.

## Session Close Rule

- At the end of every session touching `bridge/`, review this file and add newly proven domain failure knowledge or required operational facts here, separate from any `docs/` update.
- Do not add secrets, token values, local-only generated paths, or one-off guesses.
