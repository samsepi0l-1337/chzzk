# CHZZK 후원 Minecraft 플러그인 + Node 브리지 계획

## Summary

- `plugin/` Java 21 Paper/Spigot 플러그인과 `bridge/` Node.js TypeScript 브리지를 만든다.
- CHZZK 후원은 Node 브리지가 Session `DONATION` 이벤트로 받고, 로컬 HMAC webhook으로 플러그인에 전달한다.
- 플러그인은 금액이 정확히 일치할 때만 즉시 효과를 실행한다.
- 오른쪽 사이드바(scoreboard)에 후원 티어표와 대상 플레이어 총 사망 수를 표시한다.

## Key Interfaces

- 플러그인 명령:
  - `/chzzk target set <player|uuid>`: 효과 대상 지정
  - `/chzzk target clear|status`
  - `/chzzk sidebar on|off`: 사이드바 표시 토글
  - `/chzzk deaths reset`: 대상 사망 카운트 초기화
  - `/chzzk simulate <amount>`: 후원 효과 수동 테스트
  - `/chzzk reload`
- 로컬 webhook:
  - `POST http://127.0.0.1:29371/chzzk/donations`
  - payload: `eventId`, `amount`, `donatorNickname`, `message`, `receivedAt`
  - `X-Chzzk-Signature: sha256=<hex>`로 HMAC 검증하고 `eventId` 중복을 차단한다.
- 권한:
  - `chzzkdonation.admin` 하나로 v1 관리자 명령을 보호한다.

## Gameplay & Display

- 효과 매핑:
  - `1000`: 랜덤 버프
  - `2000`: 랜덤 아이템 1개
  - `3000`: 랜덤 몹 1마리
  - `5000`: 전투용 몹 1마리
  - `10000`: 전투용 몹 3마리
  - `30000`: TNT
  - `50000`: 랜덤 TP
  - `100000`: 즉사, 인벤 세이브 없음
- 사이드바:
  - 지정 대상 플레이어에게 기본 표시한다.
  - 금액별 효과 목록과 `Deaths: N`을 보여준다.
  - 대상 플레이어가 죽을 때마다 총 사망 카운트를 1 증가시키고 파일에 저장한다.
  - 다른 scoreboard 플러그인과 충돌하면 `/chzzk sidebar off`로 끌 수 있다.

## Test Plan

- 플러그인:
  - 정확 금액 매칭: `1000`, `2000`, `100000` 실행, `999`, `1001`, `5500` 무시
  - HMAC 실패, 중복 `eventId`, 대상 미지정/오프라인 처리
  - 대상 플레이어 사망 시 카운트 증가 및 `/chzzk deaths reset`
  - 사이드바 라인에 티어표와 사망 수가 반영되는지 확인
  - `./gradlew test`, `./gradlew shadowJar`
- 브리지:
  - CHZZK `payAmount` 문자열 파싱
  - OAuth refresh token 갱신 저장
  - Minecraft webhook 서명과 전달 실패 retry/log
  - `npm test`, `npm run build`
- 수동:
  - Paper/Spigot 1.21.x 서버에서 JAR 설치
  - `/chzzk target set <player>` 후 `/chzzk simulate <amount>`로 8개 티어와 사이드바 확인

## Assumptions

- 서버 기준은 Minecraft 1.21.x / Java 21이다.
- v1은 Bukkit `plugin.yml` 기반으로 만들어 Paper/Spigot 호환을 우선한다.
- 커스텀 좌표 HUD는 만들지 않고, 플러그인만으로 가능한 scoreboard 사이드바를 사용한다.
- 참고: [CHZZK Session](https://chzzk.gitbook.io/chzzk/chzzk-api/session), [CHZZK Authorization](https://chzzk.gitbook.io/chzzk/chzzk-api/authorization), [Paper plugin.yml](https://docs.papermc.io/paper/dev/plugin-yml/), [Spigot Objective](https://hub.spigotmc.org/javadocs/bukkit/org/bukkit/scoreboard/Objective.html).
