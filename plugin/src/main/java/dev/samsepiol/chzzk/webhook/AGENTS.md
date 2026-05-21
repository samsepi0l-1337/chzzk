# plugin/src/main/java/dev/samsepiol/chzzk/webhook/AGENTS.md

## Domain

- HTTP webhook server, HMAC verification, payload validation, dedupe boundary.

## Must Know

- Verify `X-Chzzk-Signature` with runtime shared secret.
- Reject malformed `eventId`, `receivedAt`, non-positive amount, and malformed content length.
- Health endpoint supports readiness checks.

## Failure Knowledge

- If signature fails, do not relax HMAC; align bridge/plugin secrets.
- If payload validation fails, do not partially process it; return 400 and keep effects untouched.
- If duplicate arrives with same webhook event id, do not re-execute; return duplicate status.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `./gradlew check shadowJar`.
- Update or add package-matching tests under `plugin/src/test/java/dev/samsepiol/chzzk`.

## Session Close Rule

- Add newly proven package-specific failure/counteraction knowledge here at session end.
