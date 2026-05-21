# docs/AGENTS.md

## Domain

- Repository-facing architecture, flow, protocol, infra, environment, and test runbooks live here.
- `docs/README.md` is the index; update it when adding, deleting, or moving docs.

## Must Know

- Docs should state proven behavior and explicit proof boundaries. Mark unverified live/AWS/Windows behavior as unproven or manual-only.
- Keep operational commands runnable and copyable; prefer exact commands over prose.
- Keep Docker, env, webhook, and command docs synchronized when changing runtime behavior.
- Do not document real secrets, token contents, private `.env` values, or local generated artifacts.

## Failure Knowledge

- If readers confuse OAuth `redirectUri` with Minecraft webhook URL, do not merge them; document them as separate flows.
- If root `.env` guidance fails for non-Docker bridge, do not imply dotenv autoload; state process env or explicit env-file loading.
- If AWS exposure guidance is unclear, do not add `29371` examples; restate SSH + `25565/tcp` public-only.
- If a verification was not run, do not hide it; state the exact credential/runtime/access gap.

## Failure Counteraction Rule

- 실패 지식은 `X가 실패하면 Y를 하라` 형식으로 남긴다.
- `Y`는 실패한 작업을 반복하는 것이 아니라 반대 방향의 안전한 대응이어야 한다: 확대 대신 축소, 실행 대신 검증, 추측 대신 로그 확인, 공개 대신 내부 격리, 수동 수정 대신 자동 생성 경로 확인, 삭제 대신 백업.
- 검증되지 않은 대응은 추가하지 않는다.

## Verification

- Run `git diff --check` for docs-only changes.
- For command/runbook edits, run non-secret static checks where possible, such as compose config or script syntax.

## Session Close Rule

- At the end of every session touching `docs/`, review this file and add newly proven documentation failure knowledge or required doc-maintenance facts here, separate from ordinary content updates.
- Do not duplicate full docs; keep this file to durable authoring rules and pitfalls.
