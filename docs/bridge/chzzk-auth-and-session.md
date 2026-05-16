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

## OAuth 인증 코드 (루트 `.env` 기준)

개발자 센터에 등록한 **로그인 리디렉션 URL**과 동일한 값을 `.env`의 `CHZZK_REDIRECT_URI`에 넣는다. `CHZZK_AUTH_STATE`가 비어 있으면 `auth:url`이 새 state를 생성해 출력한다.

### 1. 인증 URL 출력

```bash
npm run auth:url
```

또는:

```bash
./scripts/chzzk-oauth.sh url
```

브라우저에서 URL을 연 뒤, 리디렉트 URL의 `code`와 `state`를 복사한다. 출력된 `CHZZK_AUTH_STATE`와 redirect의 `state`가 같아야 한다.

### 2. 토큰 교환 (curl)

`.env`에 `CHZZK_AUTH_CODE`, `CHZZK_AUTH_STATE`를 넣거나 셸에서 export한 뒤:

```bash
./scripts/chzzk-oauth.sh exchange
```

수동 curl 예:

```bash
set -a && source .env && set +a
curl -sS -X POST "${CHZZK_OPENAPI_BASE_URL:-https://openapi.chzzk.naver.com}/auth/v1/token" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'process.stdout.write(JSON.stringify({
    grantType: "authorization_code",
    clientId: process.env.CHZZK_CLIENT_ID,
    clientSecret: process.env.CHZZK_CLIENT_SECRET,
    code: process.env.CHZZK_AUTH_CODE,
    state: process.env.CHZZK_AUTH_STATE
  }))')"
```

응답 `content.refreshToken`을 `.env`의 `CHZZK_REFRESH_TOKEN`에 넣거나 bridge auth CLI로 token store에 저장한다.

### 3. token store 저장 (기존 auth CLI)

```bash
cd bridge
npm run build
npm run auth -- --code "<code>" --state "<state>"
```

Docker volume bootstrap:

```bash
docker compose -f docker-compose.yml run --rm bridge npm run auth -- --code "<code>" --state "<state>"
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

Session 시작:

1. `GET /open/v1/sessions/auth`로 session URL을 받는다.
2. Socket.IO client로 websocket 연결한다.
3. `SYSTEM connected` 메시지에서 `sessionKey`를 얻는다.
4. `POST /open/v1/sessions/events/subscribe/donation?sessionKey=<sessionKey>`으로 donation event를 subscribe한다.
5. `DONATION` 이벤트의 `channelId`를 `CHZZK_CHANNEL_ID`와 비교한다.
6. 일치하는 이벤트만 webhook으로 전달하고, 누락 또는 불일치 이벤트는 무시한다.

CHZZK Session 구독 API는 channel ID를 query/body로 받지 않는다. 대상 스트리머 제한은 수신 payload의 `channelId`를 bridge에서 검증하는 방식으로 적용한다.

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

각 handler는 `logFailure`로 감싸져 socket listener에서 promise rejection이 누락되지 않게 한다.

## 변경 시 체크리스트

- auth 응답 shape을 바꾸면 `chzzk-auth.test.ts`를 갱신한다.
- session 메시지 shape을 바꾸면 `chzzk-session.test.ts`를 갱신한다.
- token 저장 형식을 바꾸면 migration 또는 호환 로딩을 고려한다.
- Socket.IO major version을 바꾸면 CHZZK 공식 지원 범위와 로컬 type 선언을 함께 재검토한다.
