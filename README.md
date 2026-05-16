# CHZZK Donation Minecraft

CHZZK 후원 이벤트를 Minecraft Paper 서버의 게임 효과로 변환하는 프로젝트입니다. 런타임은 CHZZK OpenAPI/Session을 담당하는 Node.js `bridge`와, Paper 서버 안에서 webhook을 받아 효과를 실행하는 Java `plugin`으로 나뉩니다.

## 아키텍처

```text
CHZZK OpenAPI / Session
  -> bridge(Node.js TypeScript)
  -> POST http://paper:29371/chzzk/donations
  -> plugin(Paper 1.21.8)
  -> Minecraft effect / scoreboard / state
```

| 영역                            | 책임                                                                                 | 대표 경로                            |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| `bridge/`                       | CHZZK token 갱신, Session Socket.IO 연결, donation payload 정규화, HMAC webhook 전송 | `bridge/src`, `bridge/test`          |
| `plugin/`                       | webhook 수신, HMAC 검증, 중복 차단, Paper 메인 스레드 효과 실행, 상태 저장           | `plugin/src/main`, `plugin/src/test` |
| `docker/`, `docker-compose.yml` | Paper + bridge 이미지 빌드, 내부 네트워크, volume, healthcheck                       | `docker/`, `docker-compose.yml`      |
| `docs/`                         | 서비스 경계, 이벤트 흐름, 환경 변수, 테스트/운영 runbook                             | `docs/README.md`                     |

플러그인 메타 정보는 `plugin/src/main/resources/plugin.yml` 기준입니다.

- name: `ChzzkDonation`
- version: `0.1.0`
- main: `dev.samsepiol.chzzk.ChzzkDonationPlugin`
- API version: `1.21`
- command: `/chzzk <target|sidebar|deaths|simulate|reload>`
- permission: `chzzkdonation.admin`

## 빠른 시작

Docker 실행이 기본 경로입니다.

```bash
cp .env.example .env
```

`.env`에 CHZZK credential과 webhook secret을 채웁니다. `EULA=true`는 Minecraft EULA를 수락한 뒤에만 설정합니다.

필수 값:

```dotenv
EULA=true
CHZZK_CLIENT_ID=your-client-id
CHZZK_CLIENT_SECRET=your-client-secret
MINECRAFT_WEBHOOK_SECRET=replace-with-a-secret
```

첫 실행에서 token store가 없으면 `.env`에 `CHZZK_REFRESH_TOKEN`을 넣고 바로 실행할 수 있습니다.

```bash
docker compose -f docker-compose.yml up --build
```

token을 `.env`에 오래 두지 않으려면 먼저 `bridge-data` volume에 token store를 생성합니다.

```bash
docker compose -f docker-compose.yml run --rm bridge npm run auth -- --refresh-token "$CHZZK_REFRESH_TOKEN"
docker compose -f docker-compose.yml up --build
```

Docker compose는 `paper` healthcheck가 성공한 뒤 `bridge`를 시작합니다. bridge도 `waitForWebhookReady`로 plugin webhook readiness를 다시 확인한 다음 CHZZK live session을 엽니다.

## 환경 변수

루트 `.env.example`은 Docker compose 기준입니다.

| 변수                           | 필수                    | 설명                                                                        |
| ------------------------------ | ----------------------- | --------------------------------------------------------------------------- |
| `EULA`                         | 예                      | Minecraft EULA 수락 여부. `true` 또는 `TRUE`일 때만 서버가 계속 시작됩니다. |
| `CHZZK_CLIENT_ID`              | 예                      | CHZZK OpenAPI client id                                                     |
| `CHZZK_CLIENT_SECRET`          | 예                      | CHZZK OpenAPI client secret                                                 |
| `CHZZK_REFRESH_TOKEN`          | token store가 없으면 예 | 첫 live session에서 `/data/.chzzk-tokens.json` 생성에 사용                  |
| `CHZZK_OPENAPI_BASE_URL`       | 아니오                  | 기본값 `https://openapi.chzzk.naver.com`                                    |
| `MINECRAFT_WEBHOOK_SECRET`     | 예                      | bridge HMAC 서명과 plugin 검증에 쓰는 공유 secret                           |
| `WEBHOOK_MAX_ATTEMPTS`         | 아니오                  | webhook 전송 최대 재시도 횟수                                               |
| `WEBHOOK_RETRY_DELAY_MS`       | 아니오                  | webhook 전송 재시도 간격                                                    |
| `WEBHOOK_READY_MAX_ATTEMPTS`   | 아니오                  | webhook readiness 확인 최대 횟수                                            |
| `WEBHOOK_READY_RETRY_DELAY_MS` | 아니오                  | readiness 확인 재시도 간격                                                  |

bridge 단독 실행은 `bridge/.env.example`을 참고합니다. Docker에서는 compose가 다음 값을 주입합니다.

```dotenv
CHZZK_TOKEN_STORE=/data/.chzzk-tokens.json
MINECRAFT_WEBHOOK_URL=http://paper:29371/chzzk/donations
MINECRAFT_WEBHOOK_HEALTH_URL=http://paper:29371/chzzk/donations/health
```

secret 값과 token store 파일(`.chzzk-tokens.json*`)은 커밋하지 않습니다.

## 로컬 빌드와 테스트

Windows에서 Docker 없이 Paper와 bridge만 실행할 때는 [docs/infra/windows-local-run.md](docs/infra/windows-local-run.md)를 따른다.

루트 스크립트:

```bash
npm test
npm run build
npm run docker:build
npm run docker:up
```

`npm test`는 현재 bridge test만 위임합니다. plugin 검증은 별도로 실행합니다.

bridge:

```bash
npm --prefix bridge run coverage
npm --prefix bridge run build
```

plugin:

```bash
./gradlew check shadowJar
```

커버리지 기준:

- bridge Vitest: branches/functions/lines/statements `100`
- plugin JaCoCo: line covered ratio `1.0`, branch covered ratio `1.0`

문서만 바꾼 경우 최소 검증은 다음입니다.

```bash
git diff --check
```

## 운영 경계

- host에 publish되는 포트는 Minecraft `25565`뿐입니다.
- plugin webhook `29371`은 Docker network 내부 전용입니다.
- AWS EC2 배포에서도 security group에 `29371`을 열지 않습니다. 외부 공개는 SSH 관리 포트와 Minecraft `25565`만 사용합니다.
- bridge는 `http://paper:29371/chzzk/donations`로만 donation payload를 보냅니다.
- plugin은 `X-Chzzk-Signature` HMAC을 검증하고, 중복 `eventId`는 duplicate로 처리합니다.
- Paper API 호출은 Minecraft 메인 스레드에서 실행되어야 합니다.
- `paper-data` volume에는 world, Paper config, plugin state가 남습니다.
- `bridge-data` volume에는 CHZZK token store가 남습니다.

volume을 삭제하면 world/state/token도 삭제됩니다.

## Socket.IO 호환성

`socket.io-client`는 CHZZK Session 문서가 지원 대상으로 명시한 `2.0.3`에 고정되어 있습니다. bridge는 다음 공통 client surface만 사용합니다.

- `io(url, options)`
- `reconnection`, `forceNew`, `timeout`, `transports`
- `socket.on(...)` for `SYSTEM`, `DONATION`, `message`, `connect_error`, `disconnect`

`socket.io-client@2.0.3`에는 알려진 transitive npm audit 항목이 있을 수 있습니다. bridge는 Docker 내부에서 plugin webhook으로만 통신하도록 격리하고, production 전에는 실제 CHZZK session smoke test를 별도로 수행합니다.

## 문서 인덱스

수정 전에는 관련 문서를 먼저 확인합니다.

| 작업                       | 문서                                    |
| -------------------------- | --------------------------------------- |
| 전체 구조와 서비스 경계    | `docs/architecture-overview.md`         |
| 후원 이벤트 처리 흐름      | `docs/flows/event-flow.md`              |
| `/chzzk` 명령              | `docs/plugin/commands.md`               |
| plugin 상태와 설정         | `docs/plugin/state-and-config.md`       |
| 후원 티어와 게임 효과      | `docs/plugin/effects-and-donation.md`   |
| CHZZK 인증과 session       | `docs/bridge/chzzk-auth-and-session.md` |
| Minecraft webhook protocol | `docs/bridge/webhook-protocol.md`       |
| Docker 실행과 배포         | `docs/infra/docker-deployment.md`       |
| Windows 로컬 (Docker 없이) | `docs/infra/windows-local-run.md`       |
| AWS EC2 배포               | `docs/infra/aws-ec2-deployment.md`      |
| 환경 변수                  | `docs/infra/env-reference.md`           |
| 테스트와 커버리지          | `docs/testing/coverage-and-runbook.md`  |

산출물과 로컬 상태는 구현 판단 기준으로 삼지 않습니다: `bridge/dist`, `bridge/coverage`, `plugin/build`, `.gradle`, `.omx`, `.cursor`, `.chzzk-tokens.json*`.

## 문제 해결

| 증상                                  | 먼저 확인할 곳                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| compose config 단계에서 실패          | `.env`의 `EULA`, `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `MINECRAFT_WEBHOOK_SECRET`        |
| Paper가 healthcheck를 통과하지 못함   | `docker logs <paper-container>`, `docs/infra/docker-deployment.md`                           |
| bridge가 webhook 준비를 기다리다 실패 | `MINECRAFT_WEBHOOK_URL`, `MINECRAFT_WEBHOOK_HEALTH_URL`, 내부 포트 `29371`                   |
| Windows에서 bridge env가 안 먹음      | 루트 `.env`만으로는 부족함. `docs/infra/windows-local-run.md`, `docs/infra/env-reference.md` |
| signature/payload 오류                | `MINECRAFT_WEBHOOK_SECRET`, `docs/bridge/webhook-protocol.md`                                |
| 후원 효과가 실행되지 않음             | `/chzzk target set <player>`, `docs/plugin/effects-and-donation.md`                          |
| token store 오류                      | `bridge-data` volume, `CHZZK_REFRESH_TOKEN`, `docs/bridge/chzzk-auth-and-session.md`         |

라이브 검증은 credential과 Minecraft runtime이 필요하므로 자동 검증에 포함하지 않습니다. 수동 smoke test는 `docs/testing/coverage-and-runbook.md`의 절차를 따릅니다.
