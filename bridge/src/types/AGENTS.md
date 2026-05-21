# bridge/src/types/AGENTS.md

## Domain

- Local TypeScript declaration shims live here.

## Must Know

- Keep declarations minimal and scoped to dependencies that lack suitable local types.
- Do not encode runtime behavior in declaration files.

## Failure Knowledge

- If TypeScript cannot resolve a dependency type, do not weaken project strictness first; add or narrow a local declaration shim.
- If a shim hides real API mismatch, remove broad `any` and model only the used surface.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `npm --prefix bridge run build`.
- Run relevant bridge tests if declarations affect call sites.

## Session Close Rule

- Add durable type-shim pitfalls here when new declaration failures are proven.
