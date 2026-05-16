# Plugin State And Config

플러그인은 Bukkit config와 별도 runtime state를 함께 사용한다.

## Config

기본 config 파일:

- `plugin/src/main/resources/config.yml`

현재 키:

```yaml
webhook:
  host: "127.0.0.1"
  port: 29371
  path: "/chzzk/donations"
  shared-secret: "change-me"
sidebar:
  enabled: true
teleport:
  radius: 64
```

사용 지점:

- `webhook.host`, `webhook.port`, `webhook.path`, `webhook.shared-secret`: `ChzzkDonationPlugin.startWebhook`.
- `teleport.radius`: `DonationEffectExecutor`.
- `sidebar.enabled`: 현재 기본 config에는 있지만 runtime sidebar 상태는 `PluginStateStore`의 `sidebarEnabled`를 사용한다.

config key를 추가하거나 의미를 바꾸면 `config.yml`, Docker entrypoint config 생성, 테스트, 문서를 함께 수정한다.

## Docker에서 생성되는 config

`docker/paper-entrypoint.sh`는 `EULA=true` 또는 `EULA=TRUE`이고 `MINECRAFT_WEBHOOK_SECRET`이 있으면 `/server/plugins/ChzzkDonation/config.yml`을 생성한다.
`EULA`가 true/TRUE가 아니면 `/server/eula.txt`에 `eula=false`를 쓰고 plugin jar 복사와 plugin config 생성 전에 실패한다.

Docker config는 다음 값을 runtime 환경 변수로 받는다.

- `MINECRAFT_WEBHOOK_SECRET`
- `MINECRAFT_WEBHOOK_PORT`
- `MINECRAFT_WEBHOOK_PATH`

Docker 실행에서는 webhook host가 `0.0.0.0`으로 설정된다. 기본 resource config는 로컬 단독 실행을 위해 `127.0.0.1`을 사용한다.

## Runtime State

상태 파일:

- Paper data folder 기준 `plugins/ChzzkDonation/state.json`
- 구현: `PluginStateStore`

저장 필드:

| 필드 | 의미 |
| --- | --- |
| `targetUuid` | target이 UUID로 확인되었을 때 저장되는 UUID 문자열 |
| `targetName` | target 표시 이름 또는 이름 기반 target |
| `sidebarEnabled` | sidebar on/off 상태 |
| `deathCount` | target 누적 사망 수 |
| `recentEventIds` | 중복 webhook event ID 차단용 최근 ID 집합 |

`PluginStateStore.save()`는 pretty JSON으로 전체 state를 쓴다. 저장 실패는 `IllegalStateException`으로 올라간다.

## Target 해석

후원 효과 대상은 `config.yml`에 쓰지 않는다. 운영자는 게임 안에서 `/chzzk target set <player>`로 target을 지정하고, 플러그인은 그 값을 `state.json`에 저장한다.

`TargetService.set` 정책:

- 인자가 UUID면 `Bukkit.getPlayer(uuid)`로 온라인 플레이어를 찾는다.
- 인자가 UUID가 아니면 `Bukkit.getPlayerExact(name)`으로 온라인 플레이어를 찾는다.
- 온라인 플레이어를 찾으면 UUID와 현재 이름을 저장한다.
- 온라인 플레이어가 없고 인자가 UUID가 아니면 UUID는 `null`, 이름은 입력값으로 저장한다.

availability:

- target이 없으면 `MISSING`
- 저장된 UUID 또는 이름으로 온라인 플레이어를 찾으면 `AVAILABLE`
- target은 있지만 온라인 플레이어를 찾지 못하면 `OFFLINE`

효과 실행은 `AVAILABLE`일 때만 진행된다.

## Death Count

`DeathCountService`는 메모리 count와 저장 콜백을 가진다.

- `increment`: count 증가 후 저장.
- `reset`: 0으로 저장.
- listener: `TargetDeathListener`.

target 플레이어가 사망하면 count를 증가시키고 sidebar를 갱신한다. plugin 효과로 발생한 즉사 여부는 `DonationEffectExecutor.consumePluginKill`로 확인한다.

## Sidebar State

`SidebarService`는 `PluginStateStore.sidebarEnabled()`가 true일 때 target 온라인 플레이어에게 새 scoreboard를 렌더링한다.

주의점:

- `clear()`는 target 온라인 플레이어의 scoreboard를 main scoreboard로 되돌린다.
- `/chzzk target set`은 기존 온라인 target의 scoreboard를 먼저 지운 뒤 새 target을 저장하고 sidebar를 갱신한다.
- reload 또는 서버 시작 시 target이 offline이면 렌더링을 건너뛴다. 이후 해당 target이 join하면 listener가 sidebar를 갱신한다.
- 다른 scoreboard 플러그인과 충돌할 수 있으므로 `/chzzk sidebar off`가 운영 escape hatch다.
- sidebar 라인은 `DonationTier.values()` 순서와 death count로 생성된다.

## 변경 시 체크리스트

- state JSON 필드를 바꾸면 기존 파일 migration 또는 `normalized()` 보완을 추가한다.
- config key를 바꾸면 Docker entrypoint와 `.env.example`도 확인한다.
- webhook lifecycle을 바꾸면 reload/disable에서 HTTP server와 executor가 함께 종료되는지 확인한다.
- target 저장 정책을 바꾸면 webhook의 `NO_TARGET` / `TARGET_OFFLINE` 결과 의미도 확인한다.
- sidebar 렌더링을 바꾸면 `SidebarLinesTest`와 scoreboard 충돌 가능성을 확인한다.
