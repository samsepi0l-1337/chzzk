# CHZZK Auth And Session Bridge

`bridge/`는 CHZZK OpenAPI와 Minecraft plugin webhook 사이의 별도 Node.js 프로세스다.

## 실행 진입점

`bridge/src/index.ts` 실행 순서:

1. `loadBridgeConfig`로 환경 변수 로드.
2. `TokenStore`에서 저장 토큰 로드.
3. 저장 토큰이 없고 `CHZZK_REFRESH_TOKEN`도 없으면 실패하고 auth CLI 실행을 요구한다.
4. 저장 토큰의 refresh token 또는 `CHZZK_REFRESH_TOKEN`으로 `refreshAccessToken`을 호출한다.
5. 갱신 토큰을 token store에 저장한다. Docker에서는 `/data/.chzzk-tokens.json`에 생성되고 이후 실행에서 재사용된다.
6. plugin webhook health ready 대기.
7. `MinecraftWebhookClient` 생성.
8. `startChzzkDonationSession`으로 CHZZK Session socket 시작.
9. `DONATION.channelId`가 `CHZZK_CHANNEL_ID`와 일치하는 이벤트만 plugin webhook으로 전달한다.

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

bridge 기동에는 token store 또는 `CHZZK_REFRESH_TOKEN`이 필요하다. 둘 다 없으면 `bridge/src/index.ts`가 즉시 실패한다.

refresh token으로 token store를 저장한다.

```bash
cd bridge
npm run build
npm run auth -- --refresh-token "<refresh-token>"
```

authorization code와 state를 이미 확보한 경우에는 auth CLI가 token exchange를 수행할 수 있다.

```bash
cd bridge
npm run build
npm run auth -- --code "<code>" --state "<state>"
```

Docker volume bootstrap:

```bash
docker compose -f docker-compose.yml run --rm bridge npm run auth -- --refresh-token "$CHZZK_REFRESH_TOKEN"
```

## Auth CLI

진입점: `bridge/src/auth-cli.ts`

Auth CLI는 `loadBridgeAuthConfig`만 사용한다. token bootstrap/exchange는 Minecraft webhook을 열지 않으므로
`MINECRAFT_WEBHOOK_SECRET` 없이 실행할 수 있다.

지원 입력:

- `--refresh-token <token>` 또는 `CHZZK_REFRESH_TOKEN`
- `--code <code>` + `--state <state>`
- `CHZZK_AUTH_CODE` + `CHZZK_AUTH_STATE`

refresh token이 있으면 refresh token 경로가 우선된다. 없으면 authorization code와 state가 필요하다.

Docker에서 refresh token을 저장하는 예:

```bash
docker compose -f docker-compose.yml run --rm bridge npm run auth -- --refresh-token "$CHZZK_REFRESH_TOKEN"
```

Docker 첫 live session에서는 `.env`의 `CHZZK_REFRESH_TOKEN`만으로도 bridge가 token store를 만든 뒤 session을 시작한다. refresh token은 secret이므로 token store 생성 후 운영 환경에서 제거할 수 있다.

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

공식 CHZZK 문서에서 후원 조회 scope는 Session API의 `DONATION` 이벤트 구독에 사용된다. 문서상 확인되는 REST endpoint는 다음 경계에 머문다.

- `GET /open/v1/sessions/auth`: 유저 session socket URL 생성.
- `GET /open/v1/sessions`: 생성된 session과 구독 이벤트 목록 조회.
- `POST /open/v1/sessions/events/subscribe/donation`: 연결된 session에 후원 이벤트 구독.
- `POST /open/v1/sessions/events/unsubscribe/donation`: 후원 이벤트 구독 취소.

과거 후원 내역을 조회하는 REST endpoint는 공식 문서에서 확인되지 않는다. bridge는 backfill 없이 session 연결 이후 도착한 실시간 `DONATION` 메시지만 처리한다.

Session 시작:

1. `GET /open/v1/sessions/auth`로 session URL을 받는다.
2. Socket.IO client로 websocket 연결한다.
3. `SYSTEM connected` 메시지에서 `sessionKey`를 얻는다.
4. `POST /open/v1/sessions/events/subscribe/donation?sessionKey=<sessionKey>`으로 donation event를 subscribe한다.
5. `DONATION` 이벤트의 `channelId`를 `CHZZK_CHANNEL_ID`와 비교한다.
6. 일치하는 이벤트만 webhook으로 전달하고, 누락 또는 불일치 이벤트는 무시한다.

CHZZK Session 구독 API는 channel ID를 query/body로 받지 않는다. 대상 스트리머 제한은 수신 payload의 `channelId`를 bridge에서 `CHZZK_CHANNEL_ID`와 비교해 적용한다. OAuth/token이 가리키는 계정이 Session 구독 주체이고, `CHZZK_CHANNEL_ID`는 수신된 `DONATION.channelId` 필터다.

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
- `message`: typed wrapper 형태의 `SYSTEM` 또는 `DONATION` 처리.
- `connect_error`: 로그.
- `disconnect`: 로그.

공식 `DONATION` 메시지 필드는 `donationType`, `channelId`, `donatorChannelId`, `donatorNickname`, `payAmount`, `donationText`, `emojis`로 문서화되어 있으며 안정적인 event id 필드는 없다. webhook `eventId`는 bridge가 생성한 내부 중복 키다.

각 handler는 `logFailure`로 감싸져 socket listener에서 promise rejection이 누락되지 않게 한다.

## 변경 시 체크리스트

- auth 응답 shape을 바꾸면 `chzzk-auth.test.ts`를 갱신한다.
- session 메시지 shape을 바꾸면 `chzzk-session.test.ts`를 갱신한다.
- token 저장 형식을 바꾸면 migration 또는 호환 로딩을 고려한다.
- Socket.IO major version을 바꾸면 CHZZK 공식 지원 범위와 로컬 type 선언을 함께 재검토한다.
