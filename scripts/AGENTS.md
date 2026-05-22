# scripts/AGENTS.md

## Domain

- Operator helpers, local/Windows/AWS startup helpers, backup/deploy checks, and manual e2e checklists live here.
- Canonical docs before edits: `docs/infra/docker-deployment.md`, `docs/infra/windows-local-run.md`, `docs/infra/aws-ec2-deployment.md`, `docs/testing/coverage-and-runbook.md`.

## Must Know

- Scripts must be safe to re-run, fail fast, and avoid printing secret values.
- Windows scripts target `C:\chzzk`; AWS scripts target in-repo Docker Compose on Amazon Linux 2023.
- `MINECRAFT_WEBHOOK_SECRET`, CHZZK client secret, refresh token, and token store contents must never be echoed.
- AWS scripts must not create paid resources unless the user explicitly requests it; current scripts prepare and operate an existing EC2 host.

## Failure Knowledge

- If SSH-launched Windows processes exit with the session, do not retry `Start-Process`; use scheduled tasks.
- If Windows copy paths fail, do not assume auth failed; create destination directories and use Windows-aware paths.
- If AWS verify fails on `29371`, do not open it publicly; make it disappear from host listen and verify internal health.
- If backups include `bridge-data`, do not treat them as harmless artifacts; protect them as token-bearing secrets.
- If AWS deploy/verify/backup uses a non-default env file, do not rerun compose without that file; pass the same `ENV_FILE` through every compose command.
- If stopped-stack backup fails after services are stopped, do not leave the stack down; restart through the EXIT trap before reporting the backup failure.
- If Windows Docker Desktop update fails over SSH with `error getting credentials` / `logon session does not exist`, do not reset Docker credentials or repeat `--pull`; use an interactive Windows session or a local-base artifact overlay from verified build outputs.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `bash -n scripts/*.sh` for shell script changes.
- Run PowerShell syntax checks when available for `.ps1` changes; otherwise state the gap.
- Run related bridge script/static tests when script behavior is covered in `bridge/test`.

## Session Close Rule

- At the end of every session touching `scripts/`, review this file and add newly proven operator failure knowledge or required script facts here, separate from any `docs/` update.
- Do not add machine-specific IPs, private usernames, or secrets unless they are already intentional public placeholders.
