# Docker Deployment

Docker 실행은 루트 `docker-compose.yml`과 `docker/` 파일들이 담당한다.

## Services

### paper

역할:

- Paper 1.21.8 서버 실행.
- Gradle로 plugin shadow jar를 빌드한 뒤 `/server/plugins/chzzk-donation.jar`로 복사.
- `paper-entrypoint.sh`에서 EULA와 plugin config를 준비.

주요 파일:

- `docker/paper.Dockerfile`
- `docker/paper-entrypoint.sh`
- `plugin/build.gradle.kts`

노출 포트:

- `25565`: Minecraft server.
- `29371`: plugin webhook. Docker network 내부에서만 접근한다.

현재 compose는 host에 `25565`만 publish한다.

`docker-compose.paper.yml`은 Windows에서 Paper만 띄워 Minecraft 접속을 검증하는 경량 경로다. 이 compose 파일은 `bridge` 서비스를 포함하지 않으며 CHZZK credential 없이 `EULA`와 `MINECRAFT_WEBHOOK_SECRET`만 요구한다.

### bridge

역할:

- TypeScript bridge를 빌드하고 `node dist/index.js` 실행.
- CHZZK token store를 `/data/.chzzk-tokens.json`에 저장.
- `paper` 서비스 webhook으로 donation payload 전송.

주요 파일:

- `docker/bridge.Dockerfile`
- `bridge/package.json`
- `bridge/src/index.ts`

Docker 내부 webhook URL:

```text
http://paper:29371/chzzk/donations
```

## Volumes

| Volume | Mount | 목적 |
| --- | --- | --- |
| `paper-data` | `/server` | Minecraft world, Paper config, plugin state |
| `bridge-data` | `/data` | CHZZK token store |

volumes를 삭제하면 world/state/token이 사라진다.

## Startup Flow

1. `docker compose up --build`가 `paper`와 `bridge` 이미지를 빌드한다.
2. `paper` image build stage에서 `:plugin:shadowJar`를 실행한다.
3. `paper-entrypoint.sh`가 plugin jar와 config를 `/server/plugins` 아래에 준비한다.
4. `paper` healthcheck가 `http://127.0.0.1:29371/chzzk/donations/health` 성공을 확인한다.
5. `bridge`는 `depends_on.paper.condition: service_healthy` 조건을 만족한 뒤 실행된다.
6. bridge 내부에서도 `waitForWebhookReady`가 plugin health endpoint 준비를 재확인한다.

compose의 `service_healthy`는 Docker healthcheck 기준 readiness를 보장한다. Paper는 첫 실행 때 서버 jar remap과 world generation이 오래 걸릴 수 있으므로 healthcheck는 `start_period: 180s`, `retries: 60`, `interval: 5s`로 최대 480초의 startup budget을 둔다. bridge의 `waitForWebhookReady`는 시작 순서 밖의 재시작과 네트워크 지연을 위한 애플리케이션 레벨 방어선이다.

## EULA

`.env`의 `EULA=true`는 Minecraft EULA를 수락한 뒤에만 설정한다.

`paper-entrypoint.sh`는 `EULA=true` 또는 `EULA=TRUE`이면 `/server/eula.txt`에 `eula=true`를 쓴다. `EULA`가 true/TRUE가 아니면 `/server/eula.txt`에 `eula=false`를 쓰고 plugin jar 복사와 plugin config 생성 전에 실패한다.
테스트에서는 `PAPER_SERVER_DIR`와 `PAPER_PLUGIN_JAR`로 runtime 경로를 임시 디렉터리로 바꾼다.
`MINECRAFT_WEBHOOK_SECRET`은 plugin config에 YAML block scalar로 기록하므로 큰따옴표와 개행이 포함되어도 YAML 구조를 깨지 않는다.

## Token Bootstrap

라이브 session 전에 token store가 없으면 bridge는 `CHZZK_REFRESH_TOKEN`으로 `/data/.chzzk-tokens.json`을 생성한 뒤 같은 시작 흐름에서 session을 시작한다. 생성된 token store는 `bridge-data` volume에 남고 이후 실행에서 재사용된다.

`.env`에 `CHZZK_REFRESH_TOKEN`을 넣은 첫 실행 예:

```bash
docker compose up --build
```

수동 bootstrap도 가능하다.

refresh token 예:

```bash
docker compose -f docker-compose.yml run --rm bridge npm run auth -- --refresh-token "$CHZZK_REFRESH_TOKEN"
```

이 명령은 `bridge-data` volume에 token JSON을 저장한다.

## Build Commands

루트 package scripts:

```bash
npm test
npm run build
npm run docker:build
npm run docker:up
npm run docker:paper:build
npm run docker:paper:up
```

Windows PowerShell에서 Paper만 실행하는 예:

```powershell
$env:EULA = "true"
$env:MINECRAFT_WEBHOOK_SECRET = "replace-with-shared-secret"
docker compose -f docker-compose.paper.yml up --build
```

Tailscale로 Windows 서버에 접속할 때는 Windows에서 `tailscale ip -4`로 IP를 확인한 뒤 Minecraft 클라이언트에서 `<windows-tailscale-ip>:25565`로 접속한다. 이 경로는 CHZZK credential 없이 서버 접속과 Paper plugin runtime만 확인하는 용도다.

Gradle:

```bash
./gradlew check shadowJar
```

bridge:

```bash
npm --prefix bridge run coverage
npm --prefix bridge run build
```

## 변경 시 체크리스트

- Paper version/build를 바꾸면 `paper-api` dependency와 runtime jar 버전을 맞춘다.
- plugin jar name을 바꾸면 `paper.Dockerfile`의 `COPY --from=plugin-build` 경로를 확인한다.
- webhook path/port를 바꾸면 compose, entrypoint, bridge env, plugin config를 같이 수정한다.
- bridge production dependency를 바꾸면 `bridge.Dockerfile`의 install/build stage가 맞는지 확인한다.
- bridge dependency를 바꾸면 `bridge/package-lock.json`을 함께 갱신하고 `npm --prefix bridge ci --dry-run`으로 Docker `npm ci` 입력을 확인한다.
- host port 공개 정책을 바꾸면 README와 webhook protocol 문서도 수정한다.
