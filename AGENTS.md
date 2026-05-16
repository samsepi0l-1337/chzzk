# AGENTS.md

## Communication

- 한국어로 짧게 답한다. 결과 먼저, 근거는 로그/응답 코드/실패 값 중심으로만 쓴다.
- 추측하지 않는다. 불확실하면 확인하고, 확인 못 한 내용은 확인 못 했다고 말한다.
- tool first. 긴 설명보다 실행, 검증, 결과를 우선한다.

## Subagent

- 모든 작업은 Subagent를 생성한다.
- main agent는 목표와 합성만, subagent는 한 가지 작업만 담당한다.
- 절대 main agent가 subagent의 작업을 대신 수행하지 않는다.
- 작업이 크기와 복잡성에 따라 필요한 만큼 subagent를 생성한다.
- subagent에 작성해야하는 항목: 모델, 추론 강도, 전달할 최소 컨텍스트(독립 윈도우), 역할(전용 지시), 허용 도구와 권한(기본은 좁게, 넓히면 이유).
- subagent에서 간단한 코드 작성은 gpt-5.3-codex-spark 모델을 사용한다.
- subagent에서 commit, push, 검색, 간단한 검증, 간단한 분석은 gpt-5.4-mini 모델을 사용한다.
- subagent에서 복잡한 코드 작성, 복잡한 검증, 복잡한 분석, 문서 작성은 gpt-5.5 모델을 사용한다.
- 코드 작성 subagent의 작업을 완료하면 코드 검증 subagent를 생성하여 검증하고, 만약 검증 subagent에서 문제가 있다면 다시 코드 작성 subagent를 생성하여 작업을 반복한다.

## Work Rules

- 단일 사용 추상화, 미래 확장용 추상화, 의미 없는 wrapper는 만들지 않는다.
- 파일은 350~400줄 이하로 유지한다.
- 큰 함수에는 분기를 계속 쌓지 않는다.
- Functional Programming, SOLID, DRY, KISS, YAGNI, Clean Code principles, TDD를 따른다.
- 파일을 하나하나 생성하지 말고, 명령어를 사용 가능한 것은 사용해서 작업한다.
- test coverage를 100% 유지한다.
- test 진행후 전체 파일을 검토하여 누락된 부분이 있는지 확인한다.
- 코드를 수정한 후에는 documentation을 업데이트한다.
- commit/push/PR은 사용자가 명시적으로 요청했을 때만 한다. PR에는 `@codex review`와 review 해야 하는 사항을 작성한다.

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
- Windows 로컬 실행 절차: `docs/infra/windows-local-run.md`
- `.env.example`, `bridge/.env.example`, `bridge/src/config.ts`, `docker-compose.yml`: `docs/infra/env-reference.md`
- `plugin/src/test`, `bridge/test`, `plugin/build.gradle.kts`, `bridge/vitest.config.ts`: `docs/testing/coverage-and-runbook.md`
- `bridge/dist`, `bridge/coverage`, `plugin/build`, `.gradle`, `.omx`, `.cursor`, `.chzzk-tokens.json*`는 산출물/로컬 상태/secret이므로 구현 판단의 기준으로 삼지 않는다.

## Project

- PR에는 `@codex review`, 문제, 원인, 수정 범위, 검증 결과, UI 변경 시 스크린샷을 포함한다.

## Learned Workspace Facts

- `bridge`는 `dotenv` 없이 `.env`를 자동 로드하지 않는다. Docker 없이 bridge를 실행할 때는 프로세스 환경 변수를 직접 설정한다.
- `CHZZK_CHANNEL_ID`는 필수 bridge env이며 수신 `DONATION.channelId` 검증 필터다. Session 구독 주체는 OAuth/token 계정이다.
- 후원은 CHZZK Session 실시간 `DONATION`만 처리한다. 공식 문서에 과거 후원 REST가 없어 backfill은 하지 않는다.
- Minecraft 효과는 `payAmount`가 tier 금액(1000·2000·3000·5000·10000·30000·50000·100000)과 정확히 일치할 때만 실행한다.
- Minecraft/Paper 런타임은 1.21.1 / Java 21로 고정한다(`plugin/build.gradle.kts`, `docker/paper.Dockerfile`).
- 공식 `DONATION` payload에 안정 event id가 없어 bridge가 webhook `eventId`를 생성한다. upstream이 동일 후원을 재전달하면 plugin dedupe가 막지 못할 수 있다.
- 마인크래프트에서 후원 효과를 받을 플레이어는 `config.yml`이 아니라 게임 내 `/chzzk target set <플레이어>`로 지정한다.
- bridge 기동에는 token store(예: `.chzzk-tokens.json`) 또는 `CHZZK_REFRESH_TOKEN`이 필요하다. 둘 다 없으면 bridge가 즉시 종료한다.
- Docker로 bridge 이미지를 빌드할 때 `bridge/package.json`과 `bridge/package-lock.json`이 불일치하면 `npm ci` 단계에서 실패한다.
- 로컬(non-Docker) 기동 순서는 Paper(webhook 포트 29371 준비) → bridge이다.
- 저장소 루트에는 Unix `gradlew`만 포함되고 `gradlew.bat`은 없다. Windows에서는 Git Bash의 `./gradlew` 또는 시스템 `gradle`을 쓴다.
- `MINECRAFT_WEBHOOK_SECRET`(bridge env)과 플러그인 `config.yml`의 `webhook.shared-secret`은 동일 값이어야 한다.
