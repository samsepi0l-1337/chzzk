# plugin/src/test/AGENTS.md

## Domain

- Plugin unit/regression tests and fakes.

## Must Know

- JaCoCo line and branch coverage must stay 100%.
- Tests should cover command validation, donation routing, effects, sidebar, state, listeners, and webhook validation without real Paper server when possible.

## Failure Knowledge

- If coverage drops, do not lower JaCoCo rules; add focused tests for missed lines/branches.
- If a Paper API interaction is hard to test, do not skip it; isolate behavior behind existing service/fake seams.
- If Gradle appears stale, do not trust cached results; run `./gradlew clean check shadowJar --rerun-tasks`.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `./gradlew check shadowJar`; use `clean ... --rerun-tasks` when new tests are not picked up.

## Session Close Rule

- Add proven plugin test failure/counteraction knowledge here after test changes.
