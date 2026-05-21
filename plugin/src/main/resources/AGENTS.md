# plugin/src/main/resources/AGENTS.md

## Domain

- Packaged plugin defaults: `config.yml` and `plugin.yml`.

## Must Know

- `config.yml` contains placeholder/default config only. Do not store real `MINECRAFT_WEBHOOK_SECRET` here.
- Docker deployment overwrites runtime plugin config from root `.env`.
- `plugin.yml` must match command class behavior and permission docs.

## Failure Knowledge

- If AWS/Docker secret needs changing, do not edit this packaged config; edit root `.env` and redeploy.
- If command metadata is missing, do not hide command code; update `plugin.yml` and command docs together.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `./gradlew check shadowJar`.
- For config/command changes, check related docs under `docs/plugin`.

## Session Close Rule

- Add resource/default-vs-runtime failure knowledge here when resource behavior changes.
