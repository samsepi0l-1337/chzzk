# plugin/src/AGENTS.md

## Domain

- Plugin production source, resources, and tests below this tree.

## Must Know

- Keep production behavior and tests in sync under `main` and `test`.
- Runtime config defaults live in resources, but server/Docker runtime config is generated or copied outside source.

## Failure Knowledge

- If a source change lacks test coverage, do not rely on manual smoke; add or update `plugin/src/test` coverage.
- If resource defaults conflict with Docker runtime, do not put secrets in resources; fix runtime generation or docs.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `./gradlew check shadowJar`.

## Session Close Rule

- Add source-tree failure/counteraction knowledge here when main/test/resource coordination changes.
