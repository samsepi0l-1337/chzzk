# docs/infra/AGENTS.md

## Domain

- Docker, Windows, AWS EC2, and environment runbooks.

## Must Know

- Docker Compose is the canonical AWS path.
- `29371` is internal-only; public access is SSH management plus Minecraft `25565`.
- Windows non-Docker path needs explicit process env and runtime plugin config.
- AWS helper scripts operate an existing EC2 host; they do not create paid AWS resources.

## Failure Knowledge

- If operators cannot reach Minecraft, do not open webhook first; verify `25565`, security group, and Paper health.
- If webhook fails on AWS, do not add a security group rule for `29371`; verify container-internal health.
- If non-Docker env fails on Windows, do not rely on root `.env` autoload; set process env or use provided scripts.
- If AWS helper scripts are run with a non-default env file, do not document only `.env`; show the same `ENV_FILE` on deploy, verify, and backup commands.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `git diff --check`.
- Run compose config or script syntax checks for edited commands.

## Session Close Rule

- Add infra runbook failure/counteraction knowledge here when deployment docs change.
