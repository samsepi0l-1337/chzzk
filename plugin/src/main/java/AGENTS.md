# plugin/src/main/java/AGENTS.md

## Domain

- Java package root for the Paper plugin.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.
## Must Know

- Follow package-local `AGENTS.md` files down to `dev/samsepiol/chzzk`.
- Keep Java code small, tested, and Paper 1.21.1 compatible.

## Failure Knowledge

- If Java code needs broad new abstraction, do not add it first; prefer existing services and package boundaries.

## Verification

- Run `./gradlew check shadowJar`.
