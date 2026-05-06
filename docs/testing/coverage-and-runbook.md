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

- `src/chzzk-auth.ts`
- `src/chzzk-session.ts`
- `src/config.ts`
- `src/donation-parser.ts`
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

- `bridge/test/chzzk-auth.test.ts`
- `bridge/test/chzzk-session.test.ts`
- `bridge/test/config.test.ts`
- `bridge/test/donation-parser.test.ts`
- `bridge/test/docker-runtime.test.ts`
- `bridge/test/token-store.test.ts`
- `bridge/test/webhook-client.test.ts`

## 변경별 최소 검증

| 변경 영역 | 최소 검증 |
| --- | --- |
| `bridge/src/config.ts` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build` |
| `bridge/src/chzzk-auth.ts` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build` |
| `bridge/src/chzzk-session.ts` | `npm --prefix bridge run coverage`, `npm --prefix bridge run build` |
| `bridge/src/webhook-client.ts` 또는 `donation-parser.ts` | bridge coverage/build + plugin webhook/donation 관련 Gradle tests |
| `plugin/src/main/java/.../donation` | `./gradlew check shadowJar` |
| `plugin/src/main/java/.../webhook` | `./gradlew check shadowJar` |
| `plugin/src/main/resources` 또는 Docker config | 관련 unit test + Docker build 가능 여부 |
| 문서만 변경 | `git diff --check`, 문서 경로 확인 |

## 수동 검증

라이브 검증은 credential과 Minecraft runtime이 필요하다. 기본 자동 검증에는 포함하지 않는다.

수동 절차:

1. `.env`에 CHZZK credential, webhook secret, `EULA=true` 설정.
2. `docker compose -f docker-compose.yml up --build`.
3. refresh token 또는 OAuth code로 bridge token store 생성.
4. Minecraft 서버 접속.
5. `/chzzk target set <player>` 실행.
6. `/chzzk simulate <amount>`로 8개 tier 확인.
7. 실제 CHZZK donation session smoke test.

## 실패 시 우선순위

1. payload/signature 실패: [bridge/webhook-protocol.md](../bridge/webhook-protocol.md)를 확인한다.
2. target 없음/오프라인: [plugin/state-and-config.md](../plugin/state-and-config.md)를 확인한다.
3. 효과 미실행: [plugin/effects-and-donation.md](../plugin/effects-and-donation.md)를 확인한다.
4. Docker readiness 실패: [infra/docker-deployment.md](../infra/docker-deployment.md)를 확인한다.
5. env 누락: [infra/env-reference.md](../infra/env-reference.md)를 확인한다.
