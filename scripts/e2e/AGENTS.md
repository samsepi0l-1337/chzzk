# scripts/e2e/AGENTS.md

## Domain

- Manual e2e checklists for plugin simulation and live CHZZK validation.

## Must Know

- Plugin-only checks use `/chzzk simulate <tier amount>` after `/chzzk target set <player>`.
- Live CHZZK checks require credentials, token store/refresh token, Paper health, and real donation/session state.
- Keep checklists free of real secrets.

## Failure Knowledge

- If `/chzzk simulate` returns `NO_TARGET`, do not debug tiers first; set or verify target.
- If live CHZZK cannot be tested, do not fake success; mark credential/broadcast/runtime gap.
- If webhook health fails, do not send donation payloads; verify Paper plugin health first.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `git diff --check`; run command snippets only when safe and non-secret.

## Session Close Rule

- Add proven manual-check failure/counteraction knowledge here after e2e checklist work.
