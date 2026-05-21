# docker/AGENTS.md

## Domain

- Docker images, Paper entrypoint behavior, runtime file generation, and container startup boundaries live here.
- Canonical docs before edits: `docs/infra/docker-deployment.md`, `docs/infra/env-reference.md`, `docs/infra/aws-ec2-deployment.md`, `docs/testing/coverage-and-runbook.md`.

## Must Know

- `docker-compose.yml` is the full Paper + bridge production path; `docker-compose.paper.yml` is Paper-only smoke.
- Host publishes only Minecraft `25565`; plugin webhook `29371` stays Docker-network/internal.
- `paper-entrypoint.sh` writes `eula.txt`, installs the plugin jar, and generates runtime plugin config from `MINECRAFT_WEBHOOK_SECRET`.
- `paper-data` stores world/config/plugin state; `bridge-data` stores CHZZK token store.
- First Paper startup can take several minutes; keep the long healthcheck budget unless fresh evidence proves otherwise.

## Failure Knowledge

- If compose config fails, do not inspect image layers first; check required env interpolation.
- If webhook is unreachable from bridge, do not publish `29371`; verify Docker internal URL `http://paper:29371/...`.
- If Paper first-run health is slow, do not shorten healthcheck; inspect Paper logs and preserve startup budget.
- If bridge image build fails on npm install, do not remove lockfile; ensure `bridge/package-lock.json` is in context.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `EULA=true CHZZK_CLIENT_ID=dummy CHZZK_CLIENT_SECRET=dummy CHZZK_CHANNEL_ID=dummy MINECRAFT_WEBHOOK_SECRET=dummy docker compose -f docker-compose.yml config`.
- Run `npm --prefix bridge run coverage` when Docker contract tests change.
- For image/runtime changes, run the narrowest possible compose build/smoke that proves the changed path.

## Session Close Rule

- At the end of every session touching `docker/` or compose runtime behavior, review this file and add newly proven deployment failure knowledge or required runtime facts here, separate from any `docs/` update.
- Do not add real secret values or host-specific temporary paths.
