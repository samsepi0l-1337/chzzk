# bridge/src/AGENTS.md

## Domain

- Runtime TypeScript source for auth, OAuth callback, session subscription, config, token store, parser, webhook client, and e2e CLIs.

## Must Know

- Keep auth/bootstrap config separate from live-session webhook config.
- `load-env-file.ts` is explicit loading for CLI paths; do not turn the bridge into implicit dotenv autoload.
- `config.ts` validates runtime env and numeric retry settings; empty values should fall back only where existing contract allows.
- `chzzk-session.ts` owns Session subscribe and channel filtering before webhook delivery.
- Chat test command is CHZZK `CHAT` content `!치지직마크 <amount>`; it requires `채팅 메시지 조회` scope and must keep the same `CHZZK_CHANNEL_ID` filter as donations.
- `webhook-client.ts` owns HMAC signing and retry behavior.

## Failure Knowledge

- If auth CLI fails on webhook env, split auth config from runtime config instead of making webhook env optional for live mode.
- If live donation parsing fails, inspect fixture/payload shape before adding generic fallback fields.
- If retry behavior fails, test status/error-specific behavior before increasing attempts.
- If chat test does not fire, inspect Session chat subscription/scope logs before debugging plugin effects.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `npm --prefix bridge run build`.
- Run `npm --prefix bridge run coverage`; keep all counters at 100%.

## Session Close Rule

- Add new source-level failure/counteraction knowledge here when `bridge/src` behavior changes.
