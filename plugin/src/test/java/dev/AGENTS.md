# plugin/src/test/java/dev/AGENTS.md

## Domain

- Java namespace segment for plugin tests.

## Must Know

- Continue reading lower-level `AGENTS.md` before editing concrete code.
- Keep namespace-only directories free of unrelated files.

## Failure Knowledge

- If ownership is unclear at this namespace level, do not edit broadly; descend to the concrete package and follow its rules.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run the verification required by the concrete package changed below this directory.

## Session Close Rule

- Add namespace-level pitfalls only if they apply across all child packages.
