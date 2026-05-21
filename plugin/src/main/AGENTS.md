# plugin/src/main/AGENTS.md

## Domain

- Production plugin Java source and packaged resources.

## Must Know

- Paper API calls must be main-thread safe.
- Packaged defaults are not the same as Docker/server runtime state.
- Keep `plugin.yml` command/permission metadata aligned with command code and docs.

## Failure Knowledge

- If production code breaks a scenario, do not patch tests around it; fix behavior and lock the regression.
- If runtime config needs a secret, do not commit it in resources; inject it through deployment/runtime config.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `./gradlew check shadowJar`.

## Session Close Rule

- Add production plugin failure/counteraction knowledge here after main-source changes.
