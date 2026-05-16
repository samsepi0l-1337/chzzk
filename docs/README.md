# Documentation Index

이 문서는 저장소를 수정하기 전에 어느 문서를 먼저 확인해야 하는지 정리한다.

## 빠른 경로

| 작업 영역 | 먼저 볼 문서 | 기준 내용 |
| --- | --- | --- |
| 전체 구조, 서비스 경계 | [architecture-overview.md](architecture-overview.md) | Paper 1.21.1 / Java 21, bridge와 plugin 책임 경계 |
| 후원 이벤트 처리 흐름 | [flows/event-flow.md](flows/event-flow.md) | CHZZK Session 실시간 `DONATION`부터 Minecraft 효과까지의 단계 |
| Paper 플러그인 명령 | [plugin/commands.md](plugin/commands.md) | `/chzzk` 관리자 명령과 권한 |
| Paper 플러그인 상태/설정 | [plugin/state-and-config.md](plugin/state-and-config.md) | `config.yml`, Docker 생성 config, runtime `state.json`, target 저장 |
| 후원 티어와 게임 효과 | [plugin/effects-and-donation.md](plugin/effects-and-donation.md) | `DonationTier` 정확 금액 매칭과 효과 실행 규칙 |
| CHZZK 인증/세션 브리지 | [bridge/chzzk-auth-and-session.md](bridge/chzzk-auth-and-session.md) | OAuth/token, Session 구독, `CHZZK_CHANNEL_ID` 필터, backfill 불가 |
| Minecraft webhook 프로토콜 | [bridge/webhook-protocol.md](bridge/webhook-protocol.md) | HMAC, payload, `amount` int 계약, 중복 한계, retry/status |
| Docker 실행/배포 | [infra/docker-deployment.md](infra/docker-deployment.md) | compose, Paper-only smoke, 포트와 volume |
| Windows 로컬 실행 | [infra/windows-local-run.md](infra/windows-local-run.md) | Docker 없이 Paper 먼저, bridge 나중 실행 |
| AWS EC2 배포 | [infra/aws-ec2-deployment.md](infra/aws-ec2-deployment.md) | 단일 EC2에서 Docker compose 운영 경계 |
| 환경 변수 | [infra/env-reference.md](infra/env-reference.md) | Docker/bridge env와 plugin config 연결 |
| 테스트/커버리지 | [testing/coverage-and-runbook.md](testing/coverage-and-runbook.md) | 100% coverage 기준과 수동 smoke 절차 |

## 문서 업데이트 규칙

- 기능 동작, 명령, 환경 변수, 프로토콜, Docker 경로를 바꾸면 같은 PR에서 관련 문서를 업데이트한다.
- `bridge/src`를 수정할 때는 `bridge/dist`를 직접 기준으로 삼지 않는다. `dist`는 빌드 산출물이다.
- `.chzzk-tokens.json*`, `.env`, `.cursor`, `.omx`는 로컬 상태 또는 secret이므로 커밋하지 않는다.
- `plugin/src/main`을 수정할 때는 대응 테스트가 `plugin/src/test`에 있는지 확인한다.
- `bridge/src`를 수정할 때는 대응 테스트가 `bridge/test`에 있는지 확인한다.
- 운영에 영향을 주는 변경은 [infra/env-reference.md](infra/env-reference.md), [infra/docker-deployment.md](infra/docker-deployment.md), [infra/aws-ec2-deployment.md](infra/aws-ec2-deployment.md)를 함께 확인한다.
