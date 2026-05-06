# Event Flow

이 문서는 CHZZK 후원 이벤트가 Minecraft 효과로 실행되는 전체 흐름을 설명한다.

## 정상 흐름

1. `bridge/src/index.ts`가 환경 변수를 로드한다.
2. `TokenStore`가 `CHZZK_TOKEN_STORE`의 저장 토큰을 읽는다.
3. `refreshAccessToken`이 CHZZK `/auth/v1/token`에 refresh token 갱신을 요청한다.
4. 갱신된 토큰을 다시 저장한다.
5. `waitForWebhookReady`가 plugin webhook health endpoint가 열릴 때까지 대기한다.
6. `createUserSessionUrl`이 CHZZK session auth URL을 받아온다.
7. `socket.io-client@2.0.3`으로 Session socket에 연결한다.
8. `SYSTEM connected` 메시지에서 `sessionKey`를 읽고 donation event를 subscribe한다.
9. `DONATION` 이벤트를 `normalizeDonation`으로 Minecraft payload로 변환한다.
10. `MinecraftWebhookClient.send`가 JSON body를 HMAC-SHA256으로 서명해 plugin webhook에 POST한다.
11. `DonationWebhookServer`가 HTTP method, body size, HMAC signature, JSON payload를 검증한다.
12. `DonationService.handle`이 중복 event ID, 후원 금액 티어, 대상 플레이어 상태를 검증한다.
13. `DonationEffectExecutor`가 Paper 메인 스레드에서 효과를 실행한다.
14. 최근 event ID를 `state.json`에 저장하고 결과를 JSON으로 반환한다.

## Payload 계약

브리지가 플러그인에 보내는 JSON:

```json
{
  "eventId": "uuid",
  "amount": 1000,
  "donatorNickname": "nickname",
  "message": "message",
  "receivedAt": "2026-05-05T00:00:00.000Z"
}
```

필수 조건:

- `eventId`: 중복 차단 키다. 같은 값이 재전송되면 plugin은 `DUPLICATE`를 반환한다.
- `amount`: `DonationTier`에 정확히 일치하는 금액만 효과를 실행한다.
- `receivedAt`: Java `Instant.parse`가 가능한 ISO 문자열이어야 한다.
- header: `X-Chzzk-Signature: sha256=<hex>` 형식이어야 한다.

## 상태 코드 의미

plugin webhook 응답:

| 상태 | 의미 |
| --- | --- |
| `200` | health check 성공 |
| `202` | 이벤트를 수신했고, 효과 실행 또는 무시 판단이 완료됨 |
| `400` | JSON payload 파싱 실패 또는 필수 필드 문제 |
| `401` | HMAC signature 실패 |
| `405` | 허용되지 않은 method |
| `409` | 중복 `eventId` |
| `413` | body 크기 제한 초과 |
| `500` | 효과 실행 중 runtime 실패 |

`UNKNOWN_AMOUNT`, `NO_TARGET`, `TARGET_OFFLINE`은 운영상 재시도해도 즉시 해결되지 않는 상태라 plugin은 `202`로 처리한다. bridge는 `2xx`를 성공으로 본다.

## Retry 경계

bridge webhook client는 transient status만 재시도한다.

- 재시도 대상: `408`, `429`, `5xx`, fetch 예외.
- 즉시 실패: `400`, `401`, `405`, `409`, `413` 등 non-transient status.
- 횟수: `WEBHOOK_MAX_ATTEMPTS`, 기본 `3`.
- 대기: `WEBHOOK_RETRY_DELAY_MS`, 기본 `500`.

plugin의 `DonationService`는 효과 실행이 성공한 뒤에만 `eventId`를 저장한다. 효과 실행 실패는 중복으로 기록하지 않는다.

## Threading 주의점

`DonationWebhookServer`는 `chzzk-webhook` daemon thread에서 HTTP 요청을 처리한다. Paper API를 직접 호출하면 안 된다. `ChzzkDonationPlugin.syncRunner`가 `Bukkit.getScheduler().callSyncMethod`로 효과 실행을 메인 스레드에 위임한다.

이 흐름을 바꿀 때는 다음을 확인한다.

- webhook thread에서 Bukkit world/player mutation을 하지 않는다.
- `sidebarService.update()`가 효과 실행 뒤 메인 스레드에서 호출된다.
- timeout은 현재 5초다. 효과가 길어지면 webhook latency와 실패 처리를 같이 재검토한다.

## 변경 시 체크리스트

- payload 필드를 바꾸면 `bridge/src/donation-parser.ts`, `plugin/.../webhook/DonationWebhookServer.java`, 양쪽 테스트를 함께 수정한다.
- HMAC 형식을 바꾸면 `bridge/src/webhook-client.ts`, `plugin/.../webhook/HmacVerifier.java`, 문서와 테스트를 함께 수정한다.
- 상태 코드 정책을 바꾸면 bridge retry 정책과 README 운영 설명을 함께 확인한다.
- CHZZK Session 이벤트 shape을 바꾸면 `bridge/src/chzzk-session.ts`와 `bridge/test/chzzk-session.test.ts`를 먼저 본다.
