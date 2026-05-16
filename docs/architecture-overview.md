# Architecture Overview

이 저장소는 CHZZK 실시간 후원 이벤트를 Minecraft Paper 서버의 게임 효과로 변환한다. 런타임은 두 프로세스로 나뉜다.

- `bridge/`: Node.js TypeScript 프로세스. CHZZK OpenAPI 인증을 갱신하고 Session Socket.IO 실시간 이벤트를 수신한다.
- `plugin/`: Java 21 Paper 플러그인. 로컬 HTTP webhook을 열고, HMAC 검증 후 Minecraft 메인 스레드에서 효과를 실행한다.

## 시스템 경계

```mermaid
flowchart LR
    CHZZK["CHZZK OpenAPI / Session\nreal-time DONATION"] --> Bridge["bridge Node process"]
    Bridge -->|"POST /chzzk/donations\nX-Chzzk-Signature"| PluginWebhook["plugin webhook server"]
    PluginWebhook --> DonationService["DonationService"]
    DonationService --> Effects["DonationEffectExecutor"]
    Effects --> Minecraft["Paper server player/world"]
    DonationService --> State["state.json"]
    State --> Sidebar["scoreboard sidebar"]
```

## 검증된 단계별 흐름

이 저장소의 Minecraft 런타임 기준은 Paper 1.21.1 / Java 21이다. 자동 검증은 credential이 필요한 실제 CHZZK live smoke를 제외하고, 다음 입력→처리→출력 경계를 단위 테스트와 coverage로 확인한다.

1. OAuth/토큰: refresh token 또는 token store 입력 → CHZZK token API 호출과 저장 → access token.
2. Session: access token 입력 → session auth URL 생성, Socket.IO 연결, donation subscribe → 실시간 `DONATION` 수신.
3. channelId 필터: `DONATION.channelId` 입력 → `CHZZK_CHANNEL_ID`와 정확 비교 → 일치 이벤트만 webhook 전달.
4. DONATION 파싱: CHZZK `payAmount` 문자열 입력 → 양의 Java `int` 범위 정수 `amount` 변환 → Minecraft payload.
5. Webhook 전송: payload 입력 → raw JSON HMAC-SHA256 서명 → plugin HTTP POST.
6. Plugin webhook 수신: POST body/signature 입력 → HMAC, JSON, `amount` int 검증 → `DonationEvent`.
7. DonationService: `DonationEvent` 입력 → dedupe, tier exact match, target availability → `DonationResult`.
8. Effect 실행: accepted tier 입력 → Bukkit main thread scheduling → 8개 tier 효과 실행.
9. 배포/설정: Docker/env/config 입력 → shared secret 일치와 내부 webhook 네트워크 → Paper/bridge 기동.

## 루트 영역

대표 파일:

- `README.md`: 현재 사용자가 실행할 기본 Docker/검증 명령.
- `PLAN.md`: 구현 의도, 후원 티어, 인터페이스, 테스트 계획의 원본 계획.
- `package.json`: 루트 npm 스크립트. 현재 bridge 테스트/빌드와 Docker 명령을 위임한다.
- `build.gradle.kts`, `settings.gradle.kts`: 루트 Gradle 태스크와 `plugin` 모듈 연결.
- `.env.example`: Docker compose 기준 환경 변수 예시.
- `AGENTS.md`: 작업 규칙과 문서 참조 경로.

루트 파일을 바꿀 때는 전체 실행 방식이나 작업 규칙이 바뀌는지 먼저 확인한다. 단일 서비스만 바꾸는 경우 루트 스크립트까지 넓히지 않는다.

## 플러그인 영역

`plugin/`은 Paper 서버 안에서 실행된다. 핵심 책임은 다음과 같다.

- `ChzzkDonationPlugin.java`: 플러그인 라이프사이클, 서비스 조립, webhook 시작/정지, reload.
- `command/`: `/chzzk` 관리자 명령과 tab complete.
- `donation/`: 후원 이벤트, 티어, 처리 결과, 중복 이벤트 처리.
- `effect/`: 실제 Minecraft 효과 실행과 랜덤 풀.
- `state/`: 대상 플레이어, 사망 수, 최근 이벤트 ID 저장.
- `display/`: scoreboard 사이드바 라인 생성과 렌더링.
- `webhook/`: 플러그인 내장 HTTP 서버와 HMAC 검증.
- `listener/`: 대상 플레이어 사망 이벤트 반영.
- `src/main/resources`: Bukkit/Paper 등록 파일과 기본 설정.

플러그인 변경 시 Paper API 호출이 메인 스레드에서 실행되는지 확인해야 한다. webhook은 별도 스레드에서 요청을 받기 때문에, 효과 실행은 `Bukkit.getScheduler().callSyncMethod` 경로를 유지해야 한다.

## 브리지 영역

`bridge/`는 CHZZK와 플러그인 사이의 외부 연동 책임만 가진다.

공식 CHZZK 문서에서 후원은 Session API의 실시간 `DONATION` 이벤트 구독으로 제공된다. 확인된 REST endpoint는 session 생성, session 목록 조회, 이벤트 구독/취소이며, 과거 후원 내역을 조회하는 REST endpoint는 문서상 제공되지 않는다. 따라서 이 아키텍처는 놓친 과거 후원을 backfill하지 않고, live session에 도착한 실시간 이벤트만 처리한다. 세부 계약은 [chzzk-auth-and-session.md](bridge/chzzk-auth-and-session.md)를 따른다.

- `config.ts`: 환경 변수 로딩과 기본값.
- `chzzk-auth.ts`: refresh token / authorization code 교환.
- `token-store.ts`: 토큰 JSON 파일 저장.
- `auth-cli.ts`: 토큰 저장을 위한 CLI 진입점.
- `chzzk-session.ts`: CHZZK Session URL 생성, donation subscribe, Socket.IO 실시간 이벤트 수신.
- `donation-parser.ts`: CHZZK donation payload를 Minecraft webhook payload로 정규화.
- `webhook-client.ts`: HMAC 서명, plugin webhook 전송, retry, readiness wait.
- `src/types/socket.io-client.d.ts`: `socket.io-client@2.0.3`용 로컬 타입 선언.

브리지 변경 시 CHZZK OpenAPI 계약, Socket.IO 2.x 호환성, webhook 프로토콜을 동시에 확인한다.

## 인프라 영역

Docker 실행은 루트 `docker-compose.yml`과 `docker/`에 있다.

- `paper`: Paper 서버와 플러그인 jar를 실행한다.
- `bridge`: 빌드된 Node 브리지 프로세스를 실행한다.
- `paper-data`: Minecraft 서버 데이터 볼륨.
- `bridge-data`: CHZZK token store 볼륨.

현재 compose는 `paper` 서비스의 `25565`만 호스트에 publish한다. webhook `29371`은 Docker network 내부에서만 bridge가 접근한다. 포트 공개 정책을 바꿀 때는 README와 Docker 문서를 함께 수정한다.

## 산출물 취급

다음 경로는 구현 판단의 기준으로 삼지 않는다.

- `bridge/dist`: TypeScript 빌드 산출물.
- `bridge/coverage`: Vitest coverage 산출물.
- `plugin/build`: Gradle 빌드 산출물.
- `.gradle`: 로컬 Gradle 캐시.
- `.omx`: 로컬 orchestration 상태와 로그.
- `.cursor`: 로컬 IDE/hook 상태.
- `.chzzk-tokens.json*`: CHZZK token store와 임시 저장 파일.

소스 변경은 `bridge/src`, `bridge/test`, `plugin/src/main`, `plugin/src/test`, `docker`, 루트 설정 파일에 한다.
