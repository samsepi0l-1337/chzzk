# docs/testing/AGENTS.md

## Domain

- Coverage, test commands, smoke runbooks, and manual verification boundaries.

## Must Know

- Bridge and plugin coverage requirements are 100%.
- Live CHZZK and real Minecraft smoke tests may be manual-only because they need credentials/runtime.
- Keep commands current with package scripts and Gradle tasks.

## Failure Knowledge

- If a test gap appears, do not weaken coverage gates; add a targeted regression test.
- If live checks cannot run, do not claim coverage; state manual-only or not-run reason.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `git diff --check`; run listed test commands when changing them.

## Session Close Rule

- Add testing runbook pitfalls here when test guidance changes.
