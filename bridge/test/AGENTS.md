# bridge/test/AGENTS.md

## Domain

- Vitest tests for bridge runtime, Docker/script contracts, env parsing, and CLI behavior.

## Must Know

- Coverage thresholds are 100% for statements, branches, functions, and lines.
- Tests should lock behavior without depending on real CHZZK credentials or live Minecraft.
- Docker contract tests should inspect config/scripts statically when a live daemon is unnecessary.

## Failure Knowledge

- If coverage drops, do not lower thresholds; add focused tests for the uncovered branch.
- If a test needs secrets, replace it with fixtures, mocks, or placeholder-only static assertions.
- If Docker daemon access is unavailable, test compose/script contracts without starting containers.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `npm --prefix bridge run coverage`.
- For a single new test file, first run `npm --prefix bridge test -- <file>` then full coverage.

## Session Close Rule

- Add proven test-harness failure/counteraction knowledge here after test changes.
