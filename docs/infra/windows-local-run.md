# Windows에서 Docker 없이 실행

Docker Compose 없이 **Paper 서버(플러그인)**와 **Node `bridge`**를 Windows에서 띄우는 절차다. Docker 기본 경로는 [docker-deployment.md](docker-deployment.md)를 따른다.

## 선행 조건

| 항목            | 권장                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 10/11                                                                                                                                             |
| Java            | **JDK 21** (플러그인 `build.gradle.kts`의 `JavaVersion.VERSION_21`, Paper 1.21.1과 맞춤)                                                                  |
| Node.js         | **LTS** (npm 포함). `bridge/package.json` 스크립트 기준                                                                                                   |
| Paper           | **1.21.1**. Docker 이미지는 `docker/paper.Dockerfile`의 `PAPER_VERSION=1.21.1` / `PAPER_BUILD=133`과 맞춘다.                                               |
| Git for Windows | 선택이지만 **권장**. 저장소 루트에 Unix용 `gradlew`만 있고 **`gradlew.bat`은 포함하지 않는다**. Git Bash에서 `./gradlew`를 실행하는 경로가 가장 단순하다. |

## 1. 플러그인 JAR 빌드

저장소 **루트**에서 실행한다.

### Git Bash (권장)

```bash
./gradlew shadowJar
```

### 시스템에 Gradle이 설치된 경우 (CMD / PowerShell)

```bat
gradle shadowJar
```

산출물 경로:

```text
plugin\build\libs\chzzk-donation-0.1.0.jar
```

이 파일을 Paper 서버 폴더의 `plugins\` 아래에 복사한다.

## 2. Paper 서버

1. [Paper 다운로드](https://papermc.io/downloads/paper)에서 **1.21.1** JAR을 받는다.
2. 서버 전용 폴더에 `paper.jar`(이름은 임의)와 위 JAR을 둔다.
3. 최초 실행 후 `eula.txt`에서 `eula=true`로 저장한다.
4. 다시 기동:

```bat
java -jar paper.jar --nogui
```

메모리 플래그가 필요하면 예: `java -Xms2G -Xmx2G -jar paper.jar --nogui`

## 3. 플러그인 설정

서버가 한 번 뜬 뒤 `plugins\ChzzkDonation\config.yml`이 생성된다. 다음을 맞춘다.

- `webhook.shared-secret`: bridge의 **`MINECRAFT_WEBHOOK_SECRET`과 동일한 값** ([env-reference.md](env-reference.md)).
- `webhook.port` 기본값은 **29371**이다. bridge 기본 URL `http://127.0.0.1:29371/chzzk/donations`과 일치해야 한다.

변경 후 `/chzzk reload` 또는 서버 재시작으로 반영한다. 명령 상세는 [plugin/commands.md](../plugin/commands.md)를 본다.

## 4. CHZZK 토큰 (선택 경로)

- **refresh token만으로 bootstrap**: `bridge`에서 `npm run build` 후 `npm run auth` ([chzzk-auth-and-session.md](../bridge/chzzk-auth-and-session.md)).
- **authorization code**: `code`와 `state`를 이미 확보한 경우 `npm run auth -- --code "<code>" --state "<state>"`로 token store를 저장할 수 있다.

## 5. bridge 환경 변수

`bridge/src/config.ts`는 **`.env` 파일을 자동으로 읽지 않는다** (`dotenv` 미사용). Windows에서는 실행 전에 **프로세스 환경 변수**를 설정한다.

필수에 가깝게 쓰는 변수:

| 변수                       | 설명                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `CHZZK_CLIENT_ID`          | CHZZK OpenAPI Client ID                                                                        |
| `CHZZK_CLIENT_SECRET`      | CHZZK OpenAPI Client Secret                                                                    |
| `CHZZK_CHANNEL_ID`         | 수신 `DONATION.channelId`와 정확 비교할 대상 채널 ID                                           |
| `MINECRAFT_WEBHOOK_SECRET` | 플러그인 `webhook.shared-secret`과 동일                                                        |
| `CHZZK_TOKEN_STORE`        | (선택) token JSON 절대 경로. 미설정 시 bridge **현재 작업 디렉터리** 기준 `.chzzk-tokens.json` |

로컬에서 Paper와 같은 머신이면 보통 추가 설정 없이 동작한다.

- `MINECRAFT_WEBHOOK_URL` 미설정 시 기본: `http://127.0.0.1:29371/chzzk/donations`
- `MINECRAFT_WEBHOOK_HEALTH_URL` 미설정 시: 위 URL + `/health`

전체 목록은 [env-reference.md](env-reference.md)를 본다.

### PowerShell 예시 (값은 placeholder)

```powershell
cd C:\path\to\chzzk\bridge

$env:CHZZK_CLIENT_ID = "your-client-id"
$env:CHZZK_CLIENT_SECRET = "your-client-secret"
$env:CHZZK_CHANNEL_ID = "target-streamer-channel-id"
$env:MINECRAFT_WEBHOOK_SECRET = "same-as-plugin-config-yml"
$env:CHZZK_TOKEN_STORE = "C:\path\to\chzzk\bridge\.chzzk-tokens.json"

# token store가 없을 때 첫 갱신용 (선택)
$env:CHZZK_REFRESH_TOKEN = "your-refresh-token"

npm install
npm run build
npm run start
```

### CMD 예시

```bat
cd C:\path\to\chzzk\bridge
set CHZZK_CLIENT_ID=your-client-id
set CHZZK_CLIENT_SECRET=your-client-secret
set CHZZK_CHANNEL_ID=target-streamer-channel-id
set MINECRAFT_WEBHOOK_SECRET=same-as-plugin-config-yml
set CHZZK_TOKEN_STORE=C:\path\to\chzzk\bridge\.chzzk-tokens.json

npm install
npm run build
npm run start
```

### auth CLI만 실행할 때 (webhook secret 불필요)

```bat
cd C:\path\to\chzzk\bridge
set CHZZK_CLIENT_ID=...
set CHZZK_CLIENT_SECRET=...
npm run build
npm run auth -- --refresh-token "paste-refresh-token-here"
```

## 6. 기동 순서

1. **Paper**를 먼저 실행해 plugin webhook이 준비되게 한다.
2. 그다음 **bridge**의 `npm run start`를 실행한다. bridge는 시작 시 webhook health를 기다린다 ([chzzk-auth-and-session.md](../bridge/chzzk-auth-and-session.md)).

## 7. 게임 안 확인

플레이어가 접속한 뒤 관리자 권한으로:

```text
/chzzk target set <플레이어 이름>
```

후원 이벤트가 해당 플레이어에게 적용되는지 확인한다. 상세는 [plugin/effects-and-donation.md](../plugin/effects-and-donation.md)를 본다.

## 8. 테스트/빌드 검증 (개발자용)

| 구분                        | 명령 (저장소 루트 또는 안내 경로)                                   |
| --------------------------- | ------------------------------------------------------------------- |
| bridge 단위 테스트/커버리지 | `npm --prefix bridge run coverage`                                  |
| bridge 빌드                 | `npm --prefix bridge run build`                                     |
| plugin                      | Git Bash: `./gradlew check shadowJar` 또는 `gradle check shadowJar` |

## 문제가 생기면

| 증상               | 확인                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Gradle 실행 안 됨  | Git Bash에서 `./gradlew shadowJar` 또는 시스템 `gradle` 사용                             |
| bridge가 바로 종료 | `CHZZK_CLIENT_ID` / `CHZZK_CLIENT_SECRET` / `CHZZK_CHANNEL_ID` / token store 또는 `CHZZK_REFRESH_TOKEN` |
| webhook 준비 실패  | Paper 기동 여부, 방화벽, `config.yml`의 `webhook.port`, bridge의 `MINECRAFT_WEBHOOK_URL` |
| signature 오류     | `MINECRAFT_WEBHOOK_SECRET`과 `config.yml`의 `shared-secret` 일치 여부                    |

## 변경 시 체크리스트

- Paper/플러그인 타깃 버전이 바뀌면 이 문서의 버전 문구와 `docker/paper.Dockerfile`을 함께 맞춘다.
- bridge가 `.env`를 읽도록 바꾸면 이 문서의 “환경 변수” 절을 수정한다.
