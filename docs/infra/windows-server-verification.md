# Windows Server Verification

이 문서는 Windows에서 CHZZK Donation Minecraft 서버를 열기 전에 확인할 검증 절차와 합격 기준을 정리한다.

## 검증 범위

| 단계                 | 목적                                                              | 자동화 가능 여부            |
| -------------------- | ----------------------------------------------------------------- | --------------------------- |
| 정적/단위 검증       | bridge, plugin, Docker 설정이 현재 계약을 깨지 않는지 확인        | 가능                        |
| Paper-only 서버 검증 | Windows에서 Minecraft 서버 접속과 plugin webhook readiness 확인   | 가능                        |
| 전체 live 검증       | CHZZK Session, bridge, Paper plugin, 실제 Minecraft 효과까지 확인 | credential과 방송 상태 필요 |

Mac이나 CI에서 통과할 수 있는 것은 Windows 실행 전 사전 조건이다. Windows에서 서버를 실제로 열었다고 주장하려면 Windows 호스트에서 Paper 또는 Docker 컨테이너를 띄우고 Minecraft 접속까지 확인한다.

## Windows 실행 방법

권장 경로는 Docker Desktop으로 Paper 서버를 먼저 띄우는 것이다. 이 경로는 CHZZK credential 없이 Minecraft 서버와 plugin runtime을 확인할 수 있다.

### 1. Paper 서버만 Docker로 실행

Windows PowerShell에서 저장소 루트로 이동한다.

```powershell
cd C:\path\to\chzzk

$env:EULA = "true"
$env:MINECRAFT_WEBHOOK_SECRET = "replace-with-shared-secret"

docker compose -f docker-compose.paper.yml up --build
```

이 상태에서 Minecraft 클라이언트는 Windows PC의 IP와 포트 `25565`로 접속한다.

```text
<windows-ip>:25565
```

같은 Windows PC에서 접속하면 다음 주소를 사용할 수 있다.

```text
127.0.0.1:25565
```

서버가 뜬 뒤 게임 안에서 관리자 권한으로 target을 지정한다.

```text
/chzzk target set <플레이어 이름>
/chzzk target status
```

후원 효과는 실제 CHZZK 이벤트 없이 simulate 명령으로 먼저 확인한다.

```text
/chzzk simulate 1000
/chzzk simulate 2000
/chzzk simulate 3000
/chzzk simulate 5000
/chzzk simulate 10000
/chzzk simulate 30000
/chzzk simulate 50000
/chzzk simulate 100000
```

### 2. CHZZK bridge까지 Docker로 실행

실제 CHZZK Session까지 붙일 때만 전체 compose를 사용한다. 루트 `.env`에 값을 채운다.

```dotenv
EULA=true
CHZZK_CLIENT_ID=your-client-id
CHZZK_CLIENT_SECRET=your-client-secret
CHZZK_CHANNEL_ID=target-streamer-channel-id
MINECRAFT_WEBHOOK_SECRET=replace-with-shared-secret
```

처음 실행 전에 token store를 만든다.

```powershell
npm run auth:login -- --env-file .env
```

처음 실행한다.

```powershell
docker compose -f docker-compose.yml up --build
```

이후에는 같은 명령으로 재시작한다.

### 3. Docker 없이 Windows에서 실행

Docker 없이 실행할 때는 Paper와 bridge를 각각 실행한다.

1. JDK 21, Node.js LTS, Git for Windows를 설치한다.
2. Git Bash에서 plugin jar를 빌드한다.

```bash
cd /c/path/to/chzzk
./gradlew shadowJar
```

3. `plugin\build\libs\chzzk-donation-0.1.0.jar`를 Paper 서버 폴더의 `plugins\`에 복사한다.
4. Paper 1.21.1 서버 폴더에서 서버를 실행한다.

```powershell
java -jar paper.jar --nogui
```

5. 최초 실행 후 `eula.txt`를 `eula=true`로 수정하고 서버를 다시 실행한다.
6. `plugins\ChzzkDonation\config.yml`에서 `webhook.shared-secret`을 bridge의 `MINECRAFT_WEBHOOK_SECRET`과 같게 설정한다.
7. 새 PowerShell에서 bridge를 실행한다.

```powershell
cd C:\path\to\chzzk\bridge

$env:CHZZK_CLIENT_ID = "your-client-id"
$env:CHZZK_CLIENT_SECRET = "your-client-secret"
$env:CHZZK_CHANNEL_ID = "target-streamer-channel-id"
$env:MINECRAFT_WEBHOOK_SECRET = "same-as-plugin-config-yml"
$env:CHZZK_TOKEN_STORE = "C:\path\to\chzzk\bridge\.chzzk-tokens.json"

npm install
npm run build
npm run start
```

`bridge/src/config.ts`는 `.env`를 자동 로드하지 않는다. Docker 없이 실행할 때는 위처럼 PowerShell/CMD 프로세스 환경 변수로 직접 넣는다.

### 4. Tailscale 원격 접속

Windows 서버를 Mac에서 RDP 없이 붙을 때의 기준이다.

1. Windows 서버에 Tailscale을 설치하고 로그인한다.
2. `tailscale status`와 `tailscale ip -4`로 tailnet 상태와 IPv4를 확인한다.
3. MagicDNS를 켠 경우에는 `서버명.tailnet명.ts.net`을, 아니면 `tailscale ip -4` 결과를 쓴다.
4. Windows 방화벽은 `25565/tcp`만 Tailscale 대역에서 허용하고, `29371/tcp`는 열지 않는다. `29371`은 같은 호스트의 Paper-bridge 사이에서만 쓴다.
5. Mac도 Tailscale에 로그인한 뒤 Minecraft 클라이언트에서 `<windows-tailscale-ip>:25565` 또는 MagicDNS 호스트로 접속한다.

PowerShell 예시:

```powershell
winget install --id Tailscale.Tailscale -e
tailscale up
tailscale status
tailscale ip -4

New-NetFirewallRule -DisplayName "Minecraft 25565 over Tailscale IPv4" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 25565 -RemoteAddress 100.64.0.0/10
New-NetFirewallRule -DisplayName "Minecraft 25565 over Tailscale IPv6" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 25565 -RemoteAddress fd7a:115c:a1e0::/48
```

Mac에서 Tailscale이 아직 없으면:

```bash
brew install tailscale
tailscale up
```

이후 Minecraft에서 `<windows-tailscale-ip>:25565`로 접속한다.

## 사전 자동 검증

저장소 루트에서 실행한다.

```bash
npm --prefix bridge run coverage
npm --prefix bridge run build
./gradlew check shadowJar
EULA=true MINECRAFT_WEBHOOK_SECRET=test-secret docker compose -f docker-compose.paper.yml config
EULA=true MINECRAFT_WEBHOOK_SECRET=test-secret docker compose -f docker-compose.paper.yml build paper
```

합격 기준:

- bridge test가 모두 통과하고 coverage가 statements/branches/functions/lines `100%`다.
- TypeScript build가 성공한다.
- Gradle `check shadowJar`가 성공하고 `plugin/build/libs/chzzk-donation-0.1.0.jar`가 생성된다.
- `docker-compose.paper.yml config`에서 host publish는 `25565:25565`만 보인다.
- Paper image build가 성공한다.

전체 Docker compose 설정도 credential placeholder로 확인할 수 있다.

```bash
EULA=true \
CHZZK_CLIENT_ID=dummy \
CHZZK_CLIENT_SECRET=dummy \
CHZZK_CHANNEL_ID=dummy \
MINECRAFT_WEBHOOK_SECRET=test-secret \
docker compose -f docker-compose.yml config
```

이 명령은 루트 `.env`도 읽을 수 있다. 실제 secret이 로그에 남지 않게 검증용 shell에서는 placeholder 환경 변수를 먼저 지정한다.

## Windows Docker 검증

Windows에서 Docker Desktop을 실행한 뒤 PowerShell에서 저장소 루트로 이동한다.

```powershell
$env:EULA = "true"
$env:MINECRAFT_WEBHOOK_SECRET = "replace-with-shared-secret"
docker compose -f docker-compose.paper.yml up --build
```

합격 기준:

- 로그에 `Loading Paper 1.21.1`와 `ChzzkDonation (0.1.0)`이 보인다.
- compose healthcheck가 healthy 상태가 된다.
- Minecraft 클라이언트에서 `<windows-ip>:25565`로 접속된다.
- 서버 콘솔 또는 게임 안에서 `/plugins`에 `ChzzkDonation`이 보인다.
- 게임 안에서 `/chzzk target status`가 응답한다.

별도 포트로 검증해야 하면 기존 서버 volume을 지우지 말고 임시 프로젝트명과 포트를 쓴다.

```powershell
$env:EULA = "true"
$env:MINECRAFT_WEBHOOK_SECRET = "replace-with-shared-secret"
docker compose -f docker-compose.paper.yml -p chzzk_windows_verify build paper
docker run -d --name chzzk-windows-verify `
  -p 25566:25565 `
  -p 29372:29371 `
  -e EULA=true `
  -e MINECRAFT_WEBHOOK_SECRET="replace-with-shared-secret" `
  -e MINECRAFT_WEBHOOK_PORT=29371 `
  -e MINECRAFT_WEBHOOK_PATH=/chzzk/donations `
  chzzk_windows_verify-paper:latest
curl.exe -fsS http://127.0.0.1:29372/chzzk/donations/health
docker rm -f chzzk-windows-verify
```

합격 기준은 `curl.exe` 응답이 다음 JSON을 반환하는 것이다.

```json
{ "status": "ok" }
```

첫 실행은 Paper remap과 world 생성 때문에 1분 이상 걸릴 수 있다. compose healthcheck는 `start_period: 180s`, `retries: 60`, `interval: 5s`를 기준으로 기다린다.

## Windows 비-Docker 검증

Docker 없이 실행할 때는 [windows-local-run.md](windows-local-run.md)를 따른다.

핵심 순서:

1. JDK 21, Node.js LTS, Paper 1.21.1을 준비한다.
2. Git Bash에서 `./gradlew shadowJar` 또는 시스템 Gradle로 `gradle shadowJar`를 실행한다.
3. `plugin\build\libs\chzzk-donation-0.1.0.jar`를 Paper 서버의 `plugins\`에 복사한다.
4. Paper를 먼저 실행한다.
5. `plugins\ChzzkDonation\config.yml`의 `webhook.shared-secret`을 bridge의 `MINECRAFT_WEBHOOK_SECRET`과 같게 맞춘다.
6. bridge 환경 변수를 PowerShell/CMD 프로세스에 직접 설정한다.
7. `bridge` 폴더에서 `npm install`, `npm run build`, `npm run start`를 실행한다.

합격 기준:

- Paper 로그에 `ChzzkDonation v0.1.0` 로드가 보인다.
- bridge가 webhook health 대기 후 CHZZK Session 시작 단계로 진행한다.
- `http://127.0.0.1:29371/chzzk/donations/health`가 Paper가 뜬 Windows 호스트에서 `{"status":"ok"}`를 반환한다.
- Minecraft에서 `/chzzk target set <플레이어>`와 `/chzzk simulate <tier 금액>`이 동작한다.

`bridge/src/config.ts`는 `.env`를 자동 로드하지 않는다. Windows 로컬 실행에서는 루트 `.env`만 만들고 끝내면 bridge가 필요한 값을 읽지 못한다.

## 전체 live 검증

CHZZK credential과 token store가 준비된 경우에만 실행한다.

1. `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_CHANNEL_ID`, `MINECRAFT_WEBHOOK_SECRET`을 설정한다.
2. token store가 없으면 `npm run auth:login -- --env-file .env`로 bootstrap한다.
3. Paper 또는 Docker Paper가 healthy인지 확인한다.
4. bridge를 시작한다.
5. Minecraft에서 `/chzzk target set <플레이어>`를 실행한다.
6. `/chzzk simulate 1000`, `/chzzk simulate 2000`, `/chzzk simulate 3000`, `/chzzk simulate 5000`, `/chzzk simulate 10000`, `/chzzk simulate 30000`, `/chzzk simulate 50000`, `/chzzk simulate 100000`을 확인한다.
7. 실제 CHZZK donation event가 들어올 때 bridge 로그와 plugin 효과를 확인한다.

합격 기준:

- bridge가 대상 `CHZZK_CHANNEL_ID`와 일치하는 `DONATION`만 webhook으로 보낸다.
- plugin이 signature를 통과한 payload만 처리한다.
- tier 금액과 정확히 일치하는 후원만 효과를 실행한다.
- duplicate `eventId` 재전송은 plugin에서 중복 처리된다.

## 실패 신호

| 실패                           | 의미                                                        | 확인 문서                                                        |
| ------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| bridge가 즉시 종료             | 필수 env 또는 token store 누락                              | [env-reference.md](env-reference.md)                             |
| webhook readiness timeout      | Paper/plugin webhook 미기동, 포트/경로 불일치, 방화벽       | [windows-local-run.md](windows-local-run.md)                     |
| signature 오류                 | `MINECRAFT_WEBHOOK_SECRET`과 `webhook.shared-secret` 불일치 | [webhook-protocol.md](../bridge/webhook-protocol.md)             |
| Docker에서 Minecraft 접속 실패 | `25565` publish, Windows 방화벽, 접속 IP 문제               | [docker-deployment.md](docker-deployment.md)                     |
| CHZZK 이벤트가 무시됨          | `DONATION.channelId`와 `CHZZK_CHANNEL_ID` 불일치            | [chzzk-auth-and-session.md](../bridge/chzzk-auth-and-session.md) |

token bootstrap은 루트에서 `npm run auth:login -- --env-file .env`를 사용한다.
