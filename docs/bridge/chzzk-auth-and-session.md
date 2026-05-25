# CHZZK Auth And Session Bridge

`bridge/`는 CHZZK OpenAPI와 Minecraft plugin webhook 사이의 별도 Node.js 프로세스다.

## 실행 진입점

`bridge/src/index.ts` 실행 순서:

1. `loadBridgeConfig`로 환경 변수 로드.
2. `TokenStore`에서 저장 토큰 로드.
3. 저장 토큰이 없으면 `auth:login` 실행을 요구한다. 운영 기본 경로는 `CHZZK_REFRESH_TOKEN` 직접 입력이 아니라 OAuth login으로 token store를 만드는 것이다.
4. 저장 토큰의 refresh token으로 `refreshAccessToken`을 호출한다.
5. 갱신 토큰을 token store에 저장한다. Docker에서는 `/data/.chzzk-tokens.json`에 생성되고 이후 실행에서 재사용된다.
6. plugin webhook health ready 대기.
7. `MinecraftWebhookClient` 생성.
8. `startChzzkDonationSession`으로 CHZZK Session socket 시작.
9. `DONATION`과 `CHAT` 이벤트를 구독한다.
10. `channelId`가 `CHZZK_CHANNEL_ID`와 일치하는 실제 후원과 채팅 테스트 명령만 plugin webhook으로 전달한다.

## Token 저장

구현: `bridge/src/token-store.ts`

저장 필드:

- `accessToken`
- `refreshToken`
- `tokenType`
- `expiresAt`
- `scope`

저장은 임시 파일에 쓴 뒤 rename한다. 경로의 parent directory는 자동 생성한다.

기본 경로:

- 로컬: `.chzzk-tokens.json`
- Docker: `/data/.chzzk-tokens.json`

토큰 파일은 secret으로 취급한다. 문서, 로그, 테스트 fixture에 실제 토큰을 넣지 않는다.

## Token bootstrap

bridge 기동에는 token store가 필요하다. 없으면 `bridge/src/index.ts`가 즉시 실패하고 `auth:login` 실행을 안내한다.

브라우저 OAuth login으로 token store를 저장한다. 이 과정에서 `CHZZK_CLIENT_ID`와 `CHZZK_CLIENT_SECRET`을 사용해 authorization code를 access token과 refresh token으로 교환한다.

```bash
npm run auth:login -- --env-file .env
```

authorization code와 state를 이미 확보한 경우에는 auth CLI가 token exchange를 수행할 수 있다.

```bash
cd bridge
npm run build
npm run auth -- --code "<code>" --state "<state>"
```

Docker volume bootstrap은 local login으로 만든 token store를 volume에 복사하는 방식으로 진행한다. 먼저 로컬에서 token store를 만든다.

```bash
npm run auth:login -- --env-file .env
```

그다음 필요하면 생성된 `bridge/.chzzk-tokens.json`을 `bridge-data` volume이나 운영 서버의 token store 경로로 복사한다.

```bash
docker compose -f docker-compose.yml run --rm -v "$PWD/bridge/.chzzk-tokens.json:/tmp/.chzzk-tokens.json:ro" bridge sh -lc 'cp /tmp/.chzzk-tokens.json "$CHZZK_TOKEN_STORE"'
```

## OAuth login

새 OAuth 로그인 경로는 local npm 실행용이다.

- `npm run auth:url`은 CHZZK authorization URL과 `state`를 출력한다.
- `npm run auth:login`은 `CHZZK_REDIRECT_URI`로 local callback server를 열고, callback `code`를 token으로 교환한 뒤 `TokenStore.save`로 저장한다.
- `npm run auth:web`은 `CHZZK_AUTH_PAGE_SECRET`로 보호되는 `/chzzk/oauth/login?secret=...` 페이지를 열고, 스트리머가 직접 CHZZK 로그인/동의 후 token store를 저장하게 한다.
- 두 CLI 모두 `--env-file <path>`를 지원한다.
- 기본 redirect URI는 `http://127.0.0.1:8080/chzzk/oauth/callback`이다. 이 값과 같은 `redirectUri`를 CHZZK Developers에 등록해야 한다.
- EC2 public callback처럼 `redirectUri` hostname이 loopback이 아니면 callback server는 기본적으로 `0.0.0.0`에 bind한다. 명시하려면 `CHZZK_AUTH_CALLBACK_BIND_HOST=0.0.0.0`을 사용한다.

예:

```bash
npm run auth:url -- --env-file .env
npm run auth:login -- --env-file .env
npm run auth:web -- --env-file .env
```

EC2에서 직접 OAuth login을 진행할 때는 다음 값을 EC2 `.env`에 둔다. CHZZK Developers에는 같은 `CHZZK_REDIRECT_URI`를 로그인 리디렉션 URL로 등록한다.

```dotenv
CHZZK_REDIRECT_URI=http://<Elastic-IP-or-public-DNS>:8080/chzzk/oauth/callback
CHZZK_AUTH_CALLBACK_BIND_HOST=0.0.0.0
CHZZK_AUTH_PAGE_SECRET=<random-page-secret>
```

`auth:web`의 접속 URL은 `http://<Elastic-IP-or-public-DNS>:8080/chzzk/oauth/login?secret=<random-page-secret>` 형식이다. 이 URL은 대상 스트리머에게만 전달하고, token store가 저장된 뒤에는 auth web process를 종료한다.

## Auth CLI

진입점: `bridge/src/auth-cli.ts`

Auth CLI는 `loadBridgeAuthConfig`만 사용한다. token bootstrap/exchange는 Minecraft webhook을 열지 않으므로
`MINECRAFT_WEBHOOK_SECRET` 없이 실행할 수 있다.

지원 입력:

- `--code <code>` + `--state <state>`
- `CHZZK_AUTH_CODE` + `CHZZK_AUTH_STATE`

운영 기본 경로는 이 CLI를 직접 쓰는 것이 아니라 `auth:login`이다. `auth:login`이 callback server를 열고 callback code를 자동으로 token exchange에 사용한다.

## CHZZK token API

구현: `bridge/src/chzzk-auth.ts`

요청:

- URL: `${CHZZK_OPENAPI_BASE_URL}/auth/v1/token`
- method: `POST`
- content type: `application/json`

지원 grant:

- `refresh_token`
- `authorization_code`

응답은 `content` 필드를 요구한다. `expiresIn`은 양수 숫자로 해석되어야 하며, `expiresAt`은 현재 시각 기준 ISO 문자열로 저장된다.

## CHZZK Session API

구현: `bridge/src/chzzk-session.ts`

공식 CHZZK 문서에서 후원 조회 scope는 Session API의 `DONATION` 이벤트 구독에 사용되고, 채팅 메시지 조회 scope는 `CHAT` 이벤트 구독에 사용된다. 문서상 확인되는 REST endpoint는 다음 경계에 머문다.

- `GET /open/v1/sessions/auth`: 유저 session socket URL 생성.
- `GET /open/v1/sessions`: 생성된 session과 구독 이벤트 목록 조회.
- `POST /open/v1/sessions/events/subscribe/donation`: 연결된 session에 후원 이벤트 구독.
- `POST /open/v1/sessions/events/unsubscribe/donation`: 후원 이벤트 구독 취소.
- `POST /open/v1/sessions/events/subscribe/chat`: 연결된 session에 채팅 이벤트 구독.
- `POST /open/v1/sessions/events/unsubscribe/chat`: 채팅 이벤트 구독 취소.

과거 후원 내역을 조회하는 REST endpoint는 공식 문서에서 확인되지 않는다. bridge는 backfill 없이 session 연결 이후 도착한 실시간 `DONATION` 메시지만 처리한다. 채팅 테스트는 과거 채팅을 읽지 않고 session 연결 이후 수신한 `CHAT` 메시지만 본다.

Session 시작:

1. `GET /open/v1/sessions/auth`로 session URL을 받는다.
2. Socket.IO client로 websocket 연결한다.
3. `SYSTEM connected` 메시지에서 `sessionKey`를 얻는다.
4. `POST /open/v1/sessions/events/subscribe/donation?sessionKey=<sessionKey>`와 `/subscribe/chat`으로 donation/chat event를 subscribe한다.
5. `DONATION` 또는 `CHAT` 이벤트의 `channelId`를 `CHZZK_CHANNEL_ID`와 비교한다.
6. 일치하는 실제 후원 이벤트는 webhook으로 전달하고, 채팅은 내용이 `!치지직마크 <금액>`일 때만 테스트 webhook payload로 변환한다.
7. 누락 또는 불일치 이벤트와 일반 채팅은 무시한다.

CHZZK Session 구독 API는 channel ID를 query/body로 받지 않는다. 대상 스트리머 제한은 수신 payload의 `channelId`를 bridge에서 `CHZZK_CHANNEL_ID`와 비교해 적용한다. OAuth/token이 가리키는 계정이 Session 구독 주체이고, `CHZZK_CHANNEL_ID`는 수신된 `DONATION.channelId`와 `CHAT.channelId` 필터다.

현재 client 옵션:

- `reconnection: true`
- `forceNew: true`
- `timeout: 3000`
- `transports: ["websocket"]`

## Socket.IO 버전 주의

`socket.io-client`는 `2.0.3`에 고정되어 있다. CHZZK Session 문서가 지원한다고 명시한 범위에 맞춘 선택이다.

주의점:

- 3.x/4.x protocol과 option 차이를 전제로 코드를 작성하지 않는다.
- 타입은 `bridge/src/types/socket.io-client.d.ts` 로컬 선언을 사용한다.
- import 형태와 이벤트 surface를 바꾸면 CHZZK Session 호환성을 다시 확인한다.

## 이벤트 처리

수신 이벤트:

- `SYSTEM`: session key subscribe 처리.
- `DONATION`: donation payload 정규화 후 webhook 전송.
- `CHAT`: `!치지직마크 <금액>` 채팅 테스트 명령을 donation webhook payload로 변환 후 전송.
- `message`: typed wrapper 형태의 `SYSTEM`, `DONATION`, `CHAT` 처리.
- `connect_error`: 로그.
- `disconnect`: 로그.

CHZZK Socket.IO payload는 객체가 아니라 JSON 문자열로 들어올 수 있다. bridge는 event handler 진입 시 문자열 payload를 JSON으로 파싱한 뒤 `SYSTEM`, `DONATION`, `CHAT`, typed `message` 처리로 넘긴다. 파싱되지 않는 문자열은 기존 필터에 따라 무시된다.

공식 `DONATION` 메시지 필드는 `donationType`, `channelId`, `donatorChannelId`, `donatorNickname`, `payAmount`, `donationText`, `emojis`로 문서화되어 있으며, 공식 문서상 `payAmount` 타입은 `String`이다. 안정적인 event id 필드는 없다. bridge는 공식 문자열 payload를 양수 정수로 정규화하고, live payload 진단에서 숫자 타입이 보일 때를 대비해 숫자도 같은 범위에서 방어적으로 허용한다. webhook `eventId`는 bridge가 생성한 내부 중복 키다.
공식 `CHAT` 메시지 필드는 `channelId`, `senderChannelId`, `profile.nickname`, `content`, `messageTime`, `emojis` 등을 포함한다. bridge는 `content`가 정확히 `!치지직마크 <금액>` 형식일 때만 금액을 정규화하고, `eventId`는 `chat-test-<uuid>`로 생성한다.

각 handler는 `logFailure`로 감싸져 socket listener에서 promise rejection이 누락되지 않게 한다.

운영 로그는 후원 경로를 단계별로 남긴다.

- `Subscribed CHZZK session events`: session 연결 후 `DONATION`, `CHAT` 구독 성공.
- `Received CHZZK donation`: CHZZK Session에서 후원 payload 수신. `hasChannelId`, `matchesTarget`, `payAmountType`으로 필터/shape를 확인한다.
- `Ignored CHZZK donation from non-target channel`: 수신했지만 `CHZZK_CHANNEL_ID`와 불일치.
- `Forwarding CHZZK donation to Minecraft webhook`: webhook 전송 직전.
- `Forwarded CHZZK donation to Minecraft webhook`: plugin webhook이 성공 응답을 반환.
- `CHZZK DONATION delivery failed`: payload 정규화 또는 webhook 전송 실패.

## 변경 시 체크리스트

- auth 응답 shape을 바꾸면 `chzzk-auth.test.ts`를 갱신한다.
- OAuth login/callback 흐름을 바꾸면 `chzzk-oauth.test.ts`, `oauth-callback-server.test.ts`, `auth-url-cli.test.ts`, `auth-login-cli.test.ts`를 갱신한다.
- session 메시지 shape을 바꾸면 `chzzk-session.test.ts`를 갱신한다.
- token 저장 형식을 바꾸면 migration 또는 호환 로딩을 고려한다.
- Socket.IO major version을 바꾸면 CHZZK 공식 지원 범위와 로컬 type 선언을 함께 재검토한다.
