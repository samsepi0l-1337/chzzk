# Effects And Donation Domain

후원 도메인은 정확한 금액 매칭, target availability 검증, 효과 실행, 중복 이벤트 저장을 담당한다.

## DonationTier

`DonationTier`는 정확한 금액만 인정한다.

| 금액 | enum | 효과 |
| --- | --- | --- |
| `1000` | `RANDOM_BUFF` | 랜덤 버프 30초 |
| `2000` | `RANDOM_ITEM` | 랜덤 아이템 1개 지급 |
| `3000` | `RANDOM_MOB` | 랜덤 몹 1마리 소환 |
| `5000` | `COMBAT_MOB` | 전투용 몹 1마리 소환 |
| `10000` | `THREE_COMBAT_MOBS` | 전투용 몹 3마리 소환 |
| `30000` | `TNT` | target 위치에 TNT 소환 |
| `50000` | `RANDOM_TELEPORT` | 설정 radius 안에서 랜덤 teleport |
| `100000` | `KILL_TARGET` | target 즉사 |

금액이 정확히 일치하지 않으면 `UNKNOWN_AMOUNT`가 반환되고 효과는 실행되지 않는다.
webhook `amount`는 JSON number이며 Java `int` 범위 안의 정수여야 한다. bridge는 `payAmount`를 정규화할 때 `2,147,483,647` 초과를 거부하고, plugin도 범위를 넘거나 소수/문자열이면 `400`으로 거부한다.
금액 tier는 `config.yml`이 아니라 `DonationTier` enum으로만 정의한다. 현재 `config.yml`의 효과 관련 설정은 `teleport.radius`뿐이다.

## DonationService 처리 순서

`DonationService.handle`은 synchronized 메서드다.

1. 이미 본 `eventId`면 `DUPLICATE`.
2. `DonationTier.findByAmount` 실패면 `UNKNOWN_AMOUNT`.
3. target이 설정되지 않았으면 `NO_TARGET`.
4. target이 offline이면 `TARGET_OFFLINE`.
5. effect runner 실행.
6. 성공 시 `eventId` 저장 후 `ACCEPTED`.
7. runtime 예외면 `EFFECT_FAILED`.

`eventId`는 효과 실행 성공 후에만 저장된다. 실패한 효과는 재시도될 수 있다.

현재 `eventId`는 CHZZK 공식 payload에서 온 값이 아니라 bridge가 webhook 전송 전에 생성한 값이다. 공식 `DONATION` payload에는 안정적인 event id가 문서화되어 있지 않고, bridge의 기본 구현은 `randomUUID()`를 사용한다. 따라서 `DonationService`의 중복 방지는 같은 `eventId`를 가진 webhook 재전송만 막으며, upstream에서 동일 후원이 새 socket 메시지로 다시 전달되어 bridge가 새 UUID를 만들면 중복으로 판정할 수 없다.

## 최근 Event ID 보관

기본 최대 보관 수는 `1024`다. 초과하면 `Set` iterator 순서의 앞쪽 항목부터 제거한다. 현재 `PluginStateStore`는 `LinkedHashSet`을 사용하므로 오래된 event ID부터 제거된다.

보관 정책을 바꾸면 중복 방지 메모리 사용량, state 파일 크기, 테스트를 같이 확인한다.

## 효과 실행

`DonationEffectExecutor`는 `Consumer<DonationTier>`다.

- target은 `TargetService.onlineTarget()`에서 가져온다.
- `teleport.radius`는 음수 입력을 `0`으로 보정한다.
- 랜덤 선택은 `RandomPools` 값에서 `Random`으로 선택한다.
- `KILL_TARGET`은 player UUID를 `pluginKills`에 기록하고 `setHealth(0.0)`을 호출한다.

Paper API를 호출하므로 반드시 서버 메인 스레드에서 실행되어야 한다. webhook에서 직접 호출하지 말고 `ChzzkDonationPlugin.syncRunner` 경로를 유지한다.

target availability도 `Bukkit.getPlayer` 계열 API를 사용하므로 webhook thread에서 직접 조회하지 않는다. `ChzzkDonationPlugin`은 availability 조회와 효과 실행을 모두 Bukkit scheduler에 올리고 최대 5초만 기다린다. timeout 또는 interrupt가 발생하면 예약된 작업을 취소하고 실행 게이트를 닫아, 큐에 남은 작업이 뒤늦게 Bukkit API를 호출하거나 같은 후원 효과가 중복 적용되지 않게 한다.

## 사망 이벤트와 인벤토리

`TargetDeathListener`는 target 플레이어 사망만 처리한다. `TargetJoinListener`는 저장된 target이 offline 상태였다가 join한 경우 sidebar를 다시 렌더링한다.

- 모든 target 사망은 death count를 증가시킨다.
- plugin 효과로 발생한 kill이면 `event.setKeepInventory(false)`를 호출한다.
- 처리 후 sidebar를 갱신한다.
- target join 후 online target이 joined player로 해석되면 sidebar를 갱신한다.

인벤토리 보존 정책을 바꾸려면 Paper gamerule, 다른 플러그인 이벤트 우선순위, 테스트 가능성을 함께 확인한다.

## RandomPools

`RandomPools`는 효과 후보 목록을 제공한다.

- buffs: potion effect type 목록.
- items: 지급 item material 목록.
- mobs: 일반 소환 entity 목록.
- combatMobs: 전투용 entity 목록.

후보를 추가할 때는 해당 Paper 버전에서 유효한 enum 값인지 확인한다. `paper-api:1.21.1-R0.1-SNAPSHOT` 기준으로 검증한다.

## 테스트

관련 테스트:

- `plugin/src/test/java/dev/samsepiol/chzzk/donation/DonationServiceTest.java`
- `plugin/src/test/java/dev/samsepiol/chzzk/donation/DonationTierTest.java`
- `plugin/src/test/java/dev/samsepiol/chzzk/donation/DonationResultTest.java`
- `plugin/src/test/java/dev/samsepiol/chzzk/webhook/DonationWebhookServerTest.java`
- `bridge/test/donation-parser.test.ts`
- `plugin/src/test/java/dev/samsepiol/chzzk/state/DeathCountServiceTest.java`
- `plugin/src/test/java/dev/samsepiol/chzzk/display/SidebarLinesTest.java`

효과 자체는 Bukkit world/player가 필요하다. 도메인 규칙은 `DonationService`와 작은 순수 함수 경계에서 테스트한다.
