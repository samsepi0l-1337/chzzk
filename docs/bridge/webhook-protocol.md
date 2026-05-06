# Minecraft Webhook Protocol

브리지와 플러그인은 로컬 HTTP webhook으로 통신한다. 이 프로토콜은 외부 CHZZK 이벤트와 Minecraft 서버 내부 효과 실행 사이의 보안 경계다.

## Endpoint

기본 URL:

```text
POST http://127.0.0.1:29371/chzzk/donations
```

Docker 내부 bridge 기준:

```text
POST http://paper:29371/chzzk/donations
```

health check:

```text
GET <webhook-url>/health
```

plugin은 configured path와 `path + "/health"` context를 등록한다.
plugin reload/disable 시 webhook HTTP server와 background executor를 함께 종료한다. reload 후 이전 webhook executor thread가 남아 있으면 lifecycle 회귀로 본다.

## Request Headers

필수 header:

```text
Content-Type: application/json
X-Chzzk-Signature: sha256=<hmac-hex>
```

서명 방식:

- algorithm: HMAC-SHA256
- secret: `MINECRAFT_WEBHOOK_SECRET` / `webhook.shared-secret`
- signed bytes: JSON request body 문자열의 UTF-8 bytes
- header prefix: `sha256=`

브리지 구현: `bridge/src/webhook-client.ts`의 `signBody`.
플러그인 구현: `plugin/src/main/java/dev/samsepiol/chzzk/webhook/HmacVerifier.java`.

## Request Body

```json
{
  "eventId": "uuid",
  "amount": 1000,
  "donatorNickname": "anonymous",
  "message": "",
  "receivedAt": "2026-05-05T00:00:00.000Z"
}
```

플러그인은 `Gson`으로 `JsonObject`를 읽고 다음 값을 요구한다.

- `eventId`: string
- `amount`: int
- `receivedAt`: ISO instant string

`donatorNickname`, `message`는 없거나 null이면 빈 문자열로 처리한다.

## Body Size

plugin webhook body 제한:

- 기본 `16 * 1024` bytes.
- `Content-Length`가 제한보다 크면 즉시 `413`.
- stream read 중 제한을 넘겨도 `413`.

큰 message나 payload 확장이 필요하면 제한, 테스트, 운영 문서를 같이 수정한다.

## Response

plugin은 `DonationResult` JSON을 반환한다.

예:

```json
{
  "status": "ACCEPTED",
  "message": "accepted"
}
```

status mapping:

| `DonationStatus` | HTTP |
| --- | --- |
| `ACCEPTED` | `202` |
| `UNKNOWN_AMOUNT` | `202` |
| `NO_TARGET` | `202` |
| `TARGET_OFFLINE` | `202` |
| `DUPLICATE` | `409` |
| `EFFECT_FAILED` | `500` |

plugin이 Bukkit 메인 스레드에서 target availability 조회 또는 효과 실행을 5초 안에 완료하지 못하면 `EFFECT_FAILED`가 반환된다. 이 timeout 경로는 bridge retry 대상인 `500`이며, plugin은 timeout된 예약 작업이 나중에 Bukkit API를 호출하거나 효과를 실행하지 않도록 취소와 실행 게이트를 함께 적용한다.

## Bridge Retry Policy

`MinecraftWebhookClient`는 다음 조건에서 재시도한다.

- `408`
- `429`
- `5xx`
- fetch 예외

영구 HTTP 실패는 첫 응답에서 종료한다. 응답 status를 검사한 뒤 retry 여부를 결정하므로
`401`, `409`, 기타 영구 `4xx`는 fetch 예외 처리 경로에 흡수되지 않는다.

재시도하지 않는 예:

- `400`: payload 문제.
- `401`: shared secret 또는 signature 문제.
- `405`: method 문제.
- `409`: 이미 처리한 event ID.
- `413`: payload 크기 문제.

기본 설정:

- `WEBHOOK_MAX_ATTEMPTS=3`
- `WEBHOOK_RETRY_DELAY_MS=500`
- `WEBHOOK_READY_MAX_ATTEMPTS=30`
- `WEBHOOK_READY_RETRY_DELAY_MS=1000`

## Security Notes

- shared secret은 bridge와 plugin 양쪽에서 동일해야 한다.
- secret 기본값 `change-me` 또는 `replace-with-shared-secret`을 운영에 사용하지 않는다.
- signature 비교는 `MessageDigest.isEqual`을 사용한다.
- webhook port를 외부에 공개할 때는 네트워크 접근 통제를 별도로 검토한다.
- 현재 Docker compose는 `29371:29371`을 host에 publish한다. 외부 공개가 불필요하면 compose 설정을 바꾼다.

## 변경 시 체크리스트

- payload schema 변경: bridge parser, plugin parser, tests, 문서 동시 수정.
- signature 변경: `signBody`, `HmacVerifier`, 테스트 동시 수정.
- status code 변경: bridge retry policy 영향 확인.
- readiness endpoint 변경: `waitForWebhookReady`, Docker health/readiness 문서 확인.
