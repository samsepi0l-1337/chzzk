# docs/flows/AGENTS.md

## Domain

- End-to-end event flow from CHZZK Session to Minecraft effects.

## Must Know

- Flow starts at realtime Session `DONATION`, passes bridge normalization/signing, plugin validation, tier routing, then main-thread effect execution.
- Mention target selection and exact tier matching when flow behavior depends on them.

## Failure Knowledge

- If flow diagrams skip validation, reverse the simplification: include signature, amount, duplicate, and target checks.
- If flow docs imply immediate effect from any amount, reverse it: state exact tier matching only.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `git diff --check`; cross-check bridge/plugin docs for changed behavior.

## Session Close Rule

- Add durable event-flow pitfalls here when flow docs are corrected.
