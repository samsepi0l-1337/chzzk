# Documentation Index

이 문서는 저장소를 수정하기 전에 어느 문서를 먼저 확인해야 하는지 정리한다.

## 빠른 경로

| 작업 영역 | 먼저 볼 문서 | 대표 경로 |
| --- | --- | --- |
| 전체 구조, 서비스 경계 | [architecture-overview.md](architecture-overview.md) | `README.md`, `PLAN.md`, `package.json`, `build.gradle.kts`, `settings.gradle.kts` |
| 후원 이벤트 처리 흐름 | [flows/event-flow.md](flows/event-flow.md) | `bridge/src/chzzk-session.ts`, `bridge/src/webhook-client.ts`, `plugin/src/main/java/dev/samsepiol/chzzk/webhook/DonationWebhookServer.java`, `plugin/src/main/java/dev/samsepiol/chzzk/donation/DonationService.java` |
| Paper 플러그인 명령 | [plugin/commands.md](plugin/commands.md) | `plugin/src/main/java/dev/samsepiol/chzzk/command/ChzzkCommand.java`, `plugin/src/main/resources/plugin.yml` |
| Paper 플러그인 상태/설정 | [plugin/state-and-config.md](plugin/state-and-config.md) | `plugin/src/main/java/dev/samsepiol/chzzk/state`, `plugin/src/main/resources/config.yml`, `docker/paper-entrypoint.sh` |
| 후원 티어와 게임 효과 | [plugin/effects-and-donation.md](plugin/effects-and-donation.md) | `plugin/src/main/java/dev/samsepiol/chzzk/donation`, `plugin/src/main/java/dev/samsepiol/chzzk/effect`, `plugin/src/main/java/dev/samsepiol/chzzk/listener` |
| CHZZK 인증/세션 브리지 | [bridge/chzzk-auth-and-session.md](bridge/chzzk-auth-and-session.md) | `bridge/src/chzzk-auth.ts`, `bridge/src/chzzk-session.ts`, `bridge/src/auth-cli.ts`, `bridge/src/token-store.ts` |
| Minecraft webhook 프로토콜 | [bridge/webhook-protocol.md](bridge/webhook-protocol.md) | `bridge/src/webhook-client.ts`, `bridge/src/donation-parser.ts`, `plugin/src/main/java/dev/samsepiol/chzzk/webhook` |
| Docker 실행/배포 | [infra/docker-deployment.md](infra/docker-deployment.md) | `docker-compose.yml`, `docker/bridge.Dockerfile`, `docker/paper.Dockerfile`, `docker/paper-entrypoint.sh` |
| AWS EC2 배포 | [infra/aws-ec2-deployment.md](infra/aws-ec2-deployment.md) | `docker-compose.yml`, `.env.example`, `docs/infra/docker-deployment.md`, `docs/infra/env-reference.md` |
| 환경 변수 | [infra/env-reference.md](infra/env-reference.md) | `.env.example`, `bridge/.env.example`, `bridge/src/config.ts`, `docker-compose.yml` |
| 테스트/커버리지 | [testing/coverage-and-runbook.md](testing/coverage-and-runbook.md) | `plugin/src/test`, `bridge/test`, `plugin/build.gradle.kts`, `bridge/vitest.config.ts` |

## 문서 업데이트 규칙

- 기능 동작, 명령, 환경 변수, 프로토콜, Docker 경로를 바꾸면 같은 PR에서 관련 문서를 업데이트한다.
- `bridge/src`를 수정할 때는 `bridge/dist`를 직접 기준으로 삼지 않는다. `dist`는 빌드 산출물이다.
- `.chzzk-tokens.json*`, `.env`, `.cursor`, `.omx`는 로컬 상태 또는 secret이므로 커밋하지 않는다.
- `plugin/src/main`을 수정할 때는 대응 테스트가 `plugin/src/test`에 있는지 확인한다.
- `bridge/src`를 수정할 때는 대응 테스트가 `bridge/test`에 있는지 확인한다.
- 운영에 영향을 주는 변경은 [infra/env-reference.md](infra/env-reference.md), [infra/docker-deployment.md](infra/docker-deployment.md), [infra/aws-ec2-deployment.md](infra/aws-ec2-deployment.md)를 함께 확인한다.
