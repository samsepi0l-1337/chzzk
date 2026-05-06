# AGENTS.md

## Communication

- 한국어로 짧게 답한다. 결과 먼저, 근거는 로그/응답 코드/실패 값 중심으로만 쓴다.
- 추측하지 않는다. 불확실하면 확인하고, 확인 못 한 내용은 확인 못 했다고 말한다.
- tool first. 긴 설명보다 실행, 검증, 결과를 우선한다.

## Subagent

- 모든 작업은 Subagent를 생성한다.
- 부모는 목표와 합성만, 서브는 한 가지 작업만 담당한다.
- 작업이 크기와 복잡성에 따라 필요한 만큼 subagent를 생성한다.
- 서브에 작성해야하는 항목: 모델, 추론 강도, 전달할 최소 컨텍스트(독립 윈도우), 역할(전용 지시), 허용 도구와 권한(기본은 좁게, 넓히면 이유).
- subagent에서 간단한 코드 작성은 gpt-5.3-codex-spark 모델을 사용한다.
- subagent에서 commit, push, 검색은 gpt-5.4-mini 모델을 사용한다.
- subagent에서 복잡한 코드 작성, 검증, 분석, 문서 작성은 gpt-5.5 모델을 사용한다.
- 코드 작성 subagent의 작업을 완료하면 코드 검증 subagent를 생성하여 검증하고, 만약 검증 subagent에서 문제가 있다면 다시 코드 작성 subagent를 생성하여 작업을 반복한다.

## Work Rules

- 단일 사용 추상화, 미래 확장용 추상화, 의미 없는 wrapper는 만들지 않는다.
- 파일은 350~400줄 이하로 유지한다.
- 큰 함수에는 분기를 계속 쌓지 않는다.
- Functional Programming, SOLID, DRY, Clean Code principles, TDD를 따른다.
- 파일을 하나하나 생성하지 말고, 명령어를 사용 가능한 것은 사용해서 작업한다.
- test coverage를 100% 유지한다.
- test 진행후 전체 파일을 검토하여 누락된 부분이 있는지 확인한다.
- 코드를 수정한 후에는 documentation을 업데이트한다.

## Documentation

- 수정하거나 작성하기 전에 관련 영역 문서를 먼저 확인한다.
- 전체 문서 인덱스: `docs/README.md`
- 전체 구조/서비스 경계: `docs/architecture-overview.md`
- 후원 이벤트 처리 흐름: `docs/flows/event-flow.md`
- `plugin/src/main/java/dev/samsepiol/chzzk/command`, `plugin/src/main/resources/plugin.yml`: `docs/plugin/commands.md`
- `plugin/src/main/java/dev/samsepiol/chzzk/state`, `plugin/src/main/resources/config.yml`, `docker/paper-entrypoint.sh`: `docs/plugin/state-and-config.md`
- `plugin/src/main/java/dev/samsepiol/chzzk/donation`, `plugin/src/main/java/dev/samsepiol/chzzk/effect`, `plugin/src/main/java/dev/samsepiol/chzzk/listener`: `docs/plugin/effects-and-donation.md`
- `bridge/src/chzzk-auth.ts`, `bridge/src/chzzk-session.ts`, `bridge/src/auth-cli.ts`, `bridge/src/token-store.ts`: `docs/bridge/chzzk-auth-and-session.md`
- `bridge/src/webhook-client.ts`, `bridge/src/donation-parser.ts`, `plugin/src/main/java/dev/samsepiol/chzzk/webhook`: `docs/bridge/webhook-protocol.md`
- `docker-compose.yml`, `docker/bridge.Dockerfile`, `docker/paper.Dockerfile`, `docker/paper-entrypoint.sh`: `docs/infra/docker-deployment.md`
- `.env.example`, `bridge/.env.example`, `bridge/src/config.ts`, `docker-compose.yml`: `docs/infra/env-reference.md`
- `plugin/src/test`, `bridge/test`, `plugin/build.gradle.kts`, `bridge/vitest.config.ts`: `docs/testing/coverage-and-runbook.md`
- `bridge/dist`, `bridge/coverage`, `plugin/build`, `.gradle`, `.omx`, `.cursor`, `.chzzk-tokens.json*`는 산출물/로컬 상태/secret이므로 구현 판단의 기준으로 삼지 않는다.

## Project

- PR에는 `@codex review`, 문제, 원인, 수정 범위, 검증 결과, UI 변경 시 스크린샷을 포함한다.
