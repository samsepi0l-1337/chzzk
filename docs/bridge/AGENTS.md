# docs/bridge/AGENTS.md

## Domain

- Bridge auth/session and webhook protocol documentation.

## Must Know

- `chzzk-auth-and-session.md` owns OAuth, token, Session subscribe, channel filter, and backfill limits.
- `webhook-protocol.md` owns HMAC, payload, retry/status, health, and dedupe limits.

## Failure Knowledge

- If live-session docs imply historical donation fetch, reverse it: state realtime `DONATION` only.
- If protocol docs imply stable upstream event ids, reverse it: state bridge-generated `eventId` and dedupe limits.
- If auth docs require webhook secret for auth-only commands, reverse it: separate auth bootstrap from live bridge runtime.
- If webhook docs imply `Content-Type` is plugin-enforced, reverse it: state plugin verifies signature/body shape, while bridge still sends JSON content type.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `git diff --check`; run bridge tests if docs encode tested behavior.

## Session Close Rule

- Add bridge-doc pitfalls here when a bridge docs mistake is found and fixed.
