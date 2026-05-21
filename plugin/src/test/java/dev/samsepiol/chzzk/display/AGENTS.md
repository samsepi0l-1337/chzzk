# plugin/src/test/java/dev/samsepiol/chzzk/display/AGENTS.md

## Domain

- Sidebar line/rendering tests.

## Must Know

- Tests must be deterministic and avoid real CHZZK/Paper server dependencies unless explicitly marked manual.
- Keep test names behavior-focused and lock regressions close to the package under test.

## Failure Knowledge

- If a production branch is uncovered, do not delete the branch or lower coverage; add the smallest regression test.
- If setup becomes too broad, do not add global fixtures; create package-local fakes/builders.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `./gradlew check shadowJar`; use `clean ... --rerun-tasks` if Gradle cache hides new tests.

## Session Close Rule

- Add newly proven test failure/counteraction knowledge here at session end.
