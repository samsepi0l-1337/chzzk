# Testing And Coverage Runbook

이 저장소는 plugin Java 테스트와 bridge TypeScript 테스트가 분리되어 있다.

## 표준 검증 명령

bridge:

```bash
npm --prefix bridge run coverage
npm --prefix bridge run build
```

plugin:

```bash
./gradlew check shadowJar
```

루트 위임:

```bash
npm test
npm run build
```

`npm test`는 현재 `npm --prefix bridge test`만 실행한다. plugin 검증은 별도로 `./gradlew check shadowJar`를 실행한다.

## Coverage 정책

### bridge

설정: `bridge/vitest.config.ts`

coverage 대상:

- `src/auth-login-cli.ts`
- `src/auth-url-cli.ts`
- `src/chzzk-auth.ts`
- `src/chzzk-oauth.ts`
- `src/chzzk-session.ts`
- `src/config.ts`
- `src/donation-parser.ts`
- `src/e2e-check-env-cli.ts`
- `src/e2e-health-cli.ts`
- `src/e2e-tools.ts`
- `src/e2e-webhook-cli.ts`
- `src/load-env-file.ts`
- `src/index.ts`
- `src/oauth-callback-server.ts`
- `src/token-store.ts`
- `src/webhook-client.ts`

threshold:

- branches `100`
- functions `100`
- lines `100`
- statements `100`

새 bridge source 파일을 추가하면 coverage include와 테스트를 함께 추가한다.

### plugin

설정: `plugin/build.gradle.kts`

`jacocoTestCoverageVerification`은 line covered ratio `1.0`과 branch covered ratio `1.0`을 요구한다.
report와 verification은 `plugin/build/jacoco/test.exec`만 사용한다.

현재 coverage 제외:

- `ChzzkDonationPlugin`
- `command/**`
- `display/SidebarService`
- `effect/**`
- `listener/**`
- `state/TargetService`

제외 목록은 Paper runtime 의존성이 큰 경계를 피하기 위한 것이다. 순수 로직을 추가할 때 제외 목록을 넓히지 말고 테스트 가능한 서비스/함수 경계를 만든다.

## 테스트 위치

plugin:

- `plugin/src/test/java/dev/samsepiol/chzzk/donation`
- `plugin/src/test/java/dev/samsepiol/chzzk/webhook`
- `plugin/src/test/java/dev/samsepiol/chzzk/state`
- `plugin/src/test/java/dev/samsepiol/chzzk/display`
- `plugin/src/test/java/dev/samsepiol/chzzk/command`

bridge:

- `bridge/test/auth-login-cli.test.ts`
- `bridge/test/auth-url-cli.test.ts`
- `bridge/test/chzzk-oauth.test.ts`
- `bridge/test/chzzk-auth.test.ts`
- `bridge/test/chzzk-session.test.ts`
- `bridge/test/config.test.ts`
- `bridge/test/donation-parser.test.ts`
- `bridge/test/docker-runtime.test.ts`
- `bridge/test/e2e-cli.test.ts`
- `bridge/test/e2e-tools.test.ts`
- `bridge/test/index.test.ts`
- `bridge/test/load-env-file.test.ts`
- `bridge/test/oauth-callback-server.test.ts`
- `bridge/test/token-store.test.ts`
- `bridge/test/webhook-client.test.ts`

## 변경별 최소 검증

| 변경 영역 | 최소 검증 |
| --- | --- |
| `bridge/src/config.ts` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build` |
| `bridge/src/auth-login-cli.ts`, `bridge/src/auth-url-cli.ts`, `bridge/src/chzzk-oauth.ts`, `bridge/src/load-env-file.ts`, `bridge/src/oauth-callback-server.ts` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build` |
| `bridge/src/chzzk-auth.ts` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build` |
| `bridge/src/chzzk-session.ts` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build` |
| `bridge/src/index.ts` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build` |
| `bridge/src/e2e-*` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build`, `npm run e2e:health` |
| `bridge/src/webhook-client.ts` 또는 `donation-parser.ts` | bridge coverage/build + plugin webhook/donation 관련 Gradle tests |
| `plugin/src/main/java/.../donation` | `./gradlew check shadowJar` |
| `plugin/src/main/java/.../webhook` | `./gradlew check shadowJar` |
| `plugin/src/main/resources` 또는 Docker config | 관련 unit test + Docker build 가능 여부 |
| 문서만 변경 | `git diff --check`, 문서 경로 확인 |

## E2E 단계별 검증

라이브 CHZZK 검증은 credential과 Minecraft runtime이 필요하다. 기본 자동 검증에는 포함하지 않는다.

### Phase 0: webhook health

Paper 서버가 켜진 뒤 plugin webhook이 받을 준비가 됐는지 확인한다. secret은 필요 없다.

```bash
npm run e2e:health
```

기본 URL은 `http://127.0.0.1:29371/chzzk/donations/health`다. 다른 포트를 쓰면 `MINECRAFT_WEBHOOK_URL` 또는 `MINECRAFT_WEBHOOK_HEALTH_URL`을 프로세스 환경 변수로 설정한다.

### Phase 1: plugin simulate

bridge 없이 Minecraft plugin 효과만 먼저 확인한다. 체크리스트는 `scripts/e2e/phase1-checklist.md`에 있다.

```text
/chzzk target set <player>
/chzzk target status
/chzzk simulate 1000
/chzzk simulate 2000
/chzzk simulate 3000
/chzzk simulate 5000
/chzzk simulate 10000
/chzzk simulate 30000
/chzzk simulate 50000
/chzzk simulate 100000
```

각 명령은 `Simulation result: ACCEPTED`를 반환하고 target 플레이어에게 해당 효과가 적용되어야 한다. `NO_TARGET`이면 `/chzzk target set <player>`가 빠진 상태이고, `TARGET_OFFLINE`이면 target 플레이어가 접속하지 않은 상태다.

### Phase 2: signed webhook without CHZZK

bridge live session 없이 plugin webhook 수신, HMAC 검증, dedupe/status mapping을 확인한다. `MINECRAFT_WEBHOOK_SECRET`은 `plugins\ChzzkDonation\config.yml`의 `webhook.shared-secret` 값과 같아야 한다.

```bash
export MINECRAFT_WEBHOOK_SECRET="same-as-plugin-config-yml"
npm run e2e:webhook -- --amount 1000
```

재시도나 dedupe 확인이 필요하면 event id를 고정한다.

```bash
npm run e2e:webhook -- --amount 1000 --event-id e2e-fixed-1000
npm run e2e:webhook -- --amount 1000 --event-id e2e-fixed-1000
```

첫 요청은 online target과 정상 tier 기준 `status: ACCEPTED`, 같은 `eventId` 재전송은 `409`와 `DUPLICATE`가 정상이다. secret이 다르면 `401`, target이 없거나 offline이면 `NO_TARGET` 또는 `TARGET_OFFLINE`이 반환된다.

### Phase 3: bridge readiness

실제 bridge를 시작하기 전에 env와 token bootstrap 상태를 확인한다. 값은 출력하지 않고 변수 이름과 token store 경로만 출력한다.

```bash
npm run e2e:health
npm run e2e:check-env
```

`bridge`는 `.env`를 자동 로드하지 않는다. Docker 없이 실행할 때는 현재 shell의 프로세스 환경 변수로 `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_CHANNEL_ID`, `MINECRAFT_WEBHOOK_SECRET`, token store 또는 `CHZZK_REFRESH_TOKEN`을 설정한다.

### Phase 4: live CHZZK

credential과 실제 후원이 필요한 수동 단계다. 체크리스트는 `scripts/e2e/live-chzzk-checklist.md`에 있다.

1. CHZZK credential, `CHZZK_CHANNEL_ID`, webhook secret, token store 또는 `CHZZK_REFRESH_TOKEN`을 준비한다.
2. Paper를 먼저 띄우고 `npm run e2e:health`로 webhook readiness를 확인한다.
3. `npm run e2e:check-env`로 bridge env를 확인한다.
4. `npm --prefix bridge run start`로 bridge를 시작한다.
5. Minecraft에서 `/chzzk target set <player>`를 실행한다.
6. 실제 CHZZK donation session smoke test를 진행한다.

## 실패 시 우선순위

1. payload/signature 실패: [bridge/webhook-protocol.md](../bridge/webhook-protocol.md)를 확인한다.
2. target 없음/오프라인: [plugin/state-and-config.md](../plugin/state-and-config.md)를 확인한다.
3. 효과 미실행: [plugin/effects-and-donation.md](../plugin/effects-and-donation.md)를 확인한다.
4. Docker readiness 실패: [infra/docker-deployment.md](../infra/docker-deployment.md)를 확인한다.
5. env 누락: [infra/env-reference.md](../infra/env-reference.md)를 확인한다.
