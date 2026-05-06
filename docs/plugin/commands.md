# Plugin Commands

플러그인 명령은 `plugin/src/main/java/dev/samsepiol/chzzk/command/ChzzkCommand.java`에 구현되어 있고, `plugin/src/main/resources/plugin.yml`에 `/chzzk`로 등록되어 있다.

## 권한

모든 `/chzzk` 하위 명령은 `plugin.yml`의 `chzzkdonation.admin` 권한 아래 있다.

- 기본값: `op`
- 목적: v1 관리자 명령을 단일 권한으로 보호한다.
- 권한을 세분화하려면 `plugin.yml`, 명령 테스트, 운영 문서를 함께 수정한다.

## 하위 명령

| 명령 | 동작 | 주요 서비스 |
| --- | --- | --- |
| `/chzzk target set <player|uuid>` | 기존 온라인 target sidebar를 먼저 지운 뒤 효과 대상 저장. 온라인 플레이어면 UUID와 현재 이름을 저장하고, 이름만 주면 이름 기준 target으로 저장한다. | `TargetService`, `PluginStateStore`, `SidebarService` |
| `/chzzk target clear` | target을 지우고 sidebar를 기본 scoreboard로 되돌린다. | `TargetService`, `SidebarService` |
| `/chzzk target status` | 현재 target과 availability를 표시한다. | `TargetService` |
| `/chzzk sidebar on` | sidebar 표시를 켜고 즉시 갱신한다. | `SidebarService`, `PluginStateStore` |
| `/chzzk sidebar off` | sidebar 표시를 끄고 target scoreboard를 main scoreboard로 되돌린다. | `SidebarService`, `PluginStateStore` |
| `/chzzk deaths reset` | target 사망 수를 0으로 저장하고 sidebar를 갱신한다. | `DeathCountService`, `SidebarService` |
| `/chzzk simulate <amount>` | 실제 webhook 없이 후원 이벤트를 생성해 효과 처리 경로를 실행한다. | `DonationService` |
| `/chzzk reload` | config reload, webhook restart, listener 재등록, 서비스 재생성. | `ChzzkDonationPlugin` |

## Tab complete

현재 tab complete는 정적 목록이다.

- 1번째 인자: `target`, `sidebar`, `deaths`, `simulate`, `reload`
- `target`: `set`, `clear`, `status`
- `sidebar`: `on`, `off`
- `deaths`: `reset`

플레이어 이름 completion은 아직 없다. 추가할 때는 offline/online target 저장 정책과 같이 검토한다.

## Simulation 경로

`/chzzk simulate <amount>`는 다음 이벤트를 만든다.

- `eventId`: `simulate-<UUID>`
- `amount`: 명령 인자로 받은 정수
- `donatorNickname`: 명령 sender 이름
- `message`: `manual simulation`
- `receivedAt`: 현재 시각

이 명령은 `DonationService.handle`을 그대로 호출하므로 중복 처리, 티어 매칭, target availability, 효과 실행 실패 처리를 모두 통과한다.

## Reload 주의점

`reloadChzzk`는 다음 순서로 동작한다.

1. Bukkit config reload.
2. 기존 webhook server stop.
3. 현재 plugin listener 전체 unregister.
4. 서비스 재생성.
5. command executor/tab completer 재등록.
6. listener 재등록.
7. webhook 재시작.
8. sidebar update.

명령, listener, webhook lifecycle을 수정할 때는 reload 이후 중복 listener 또는 죽은 webhook thread가 남지 않는지 확인한다.

저장된 target이 reload 시점에 offline이면 즉시 sidebar를 렌더링하지 못한다. 이후 해당 target이 join하면 listener가 target을 다시 해석하고 sidebar를 갱신한다.

## 테스트

관련 테스트:

- `plugin/src/test/java/dev/samsepiol/chzzk/command/ChzzkCommandTest.java`

명령 파싱, 메시지, side effect를 바꾸면 이 테스트를 먼저 갱신한다. Bukkit 서버가 필요한 동작은 작은 서비스 단위로 분리해 테스트 가능한 경계를 유지한다.
