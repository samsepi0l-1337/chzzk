# docs/infra/AGENTS.md

## Domain

- Docker, Windows, AWS EC2, and environment runbooks.

## Must Know

- AWS uses native Paper + Node bridge processes under `tmux` or `screen`; Docker Compose is not the AWS path.
- `29371` is loopback-only on AWS; public access is SSH management plus Minecraft `25565`.
- Windows non-Docker path needs explicit process env and runtime plugin config.
- AWS helper scripts mostly operate an existing EC2 host; `scripts/aws-ec2-provision.sh` is the only paid-resource creation entrypoint and defaults to plan-only unless `AWS_EC2_APPLY=true`.

## Failure Knowledge

- If operators cannot reach Minecraft, do not open webhook first; verify `25565`, security group, and Paper health.
- If webhook fails on AWS, do not add a security group rule for `29371`; verify local loopback health and the Paper session.
- If non-Docker env fails on Windows, do not rely on root `.env` autoload; set process env or use provided scripts.
- If AWS helper scripts are run with a non-default env file, do not document only `.env`; show the same `ENV_FILE` on deploy, verify, and backup commands.
- If AWS provisioning appears to do nothing, do not bypass the safety gate; review `config/aws-ec2.env` and then set `AWS_EC2_APPLY=true` only when EC2 creation is intended.
- If AWS deploy needs process supervision, do not add Docker; use `tmux` or `screen` sessions and verify them directly.
- If Amazon Linux 2023 user-data fails with `curl-minimal` package conflicts, do not retry the same `curl` install; use `curl-minimal` and rerun bootstrap.
- If AWS deploy fails because Gradle cannot find a Java compiler, do not treat Java 21 runtime as sufficient; install the Corretto 21 `devel` package.
- If `ss` reports `[::ffff:127.0.0.1]:29371`, do not open or close ports; treat it as loopback-only IPv4-mapped listening.
- If chunk loading is slow on AWS, do not raise view distance first; on `t4g.large` use about 5 GiB Paper heap, lower simulation distance, disable sync chunk writes, then scale to `t4g.xlarge`. On `t4g.xlarge`, use about 10 GiB Paper heap and keep simulation distance conservative.
- If Paper on `t4g.xlarge` still logs `ChunkTaskScheduler` with only 1 I/O and 1 worker thread, do not tune heap again; set `paper-global.yml` chunk-system `io-threads=3`, `worker-threads=4`, raise player chunk load/send rates, and extend `paper-world-defaults.yml` chunk unload delay.
- If the AWS bridge is optimized for event runtime, do not document `npm run start` as the native deployment path; deploy builds with npm, prunes dev dependencies, then starts `node dist/index.js` directly under tmux/screen.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `git diff --check`.
- Run compose config or script syntax checks for edited commands.

## Session Close Rule

- Add infra runbook failure/counteraction knowledge here when deployment docs change.
