# CHZZK 후원 Minecraft 플러그인 + Node 브리지 검증 요약

## Summary

- `plugin/` Java 21 Paper 1.21.1 플러그인과 `bridge/` Node.js TypeScript 브리지를 만든다.
- CHZZK 후원은 Node 브리지가 Session 실시간 `DONATION` 이벤트로 받고, 로컬 HMAC webhook으로 플러그인에 전달한다.
- 플러그인은 금액이 정확히 일치할 때만 즉시 효과를 실행한다.
- 오른쪽 사이드바(scoreboard)에 후원 티어표와 대상 플레이어 총 사망 수를 표시한다.
- 공식 문서에서 과거 후원 내역 REST endpoint는 확인되지 않았으므로 backfill은 지원하지 않는다.

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
  - `amount`는 양의 정수이며 plugin Java `int` 범위 안이어야 한다.
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
- 효과 target은 `config.yml`이 아니라 `/chzzk target set <player>` 명령으로 지정한다.

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
- Paper 1.21.1 서버에서 JAR 설치
  - `/chzzk target set <player>` 후 `/chzzk simulate <amount>`로 8개 티어와 사이드바 확인

## Assumptions

- 서버 기준은 Minecraft/Paper 1.21.1 / Java 21이다.
- v1은 Bukkit `plugin.yml` 기반으로 만들되 Paper 1.21.1 런타임을 기준으로 검증한다.
- 커스텀 좌표 HUD는 만들지 않고, 플러그인만으로 가능한 scoreboard 사이드바를 사용한다.
- 공식 CHZZK 문서상 과거 후원 내역 REST endpoint는 확인되지 않는다. v1은 session 연결 이후 수신한 실시간 후원만 처리하며 backfill은 지원하지 않는다.
- 공식 `DONATION` payload에는 안정적인 event id가 문서화되어 있지 않다. 현재 webhook `eventId`는 bridge가 생성한 중복 차단 키이며, upstream 중복 메시지까지 보장하지 않는다.
- 참고: [CHZZK Session](https://chzzk.gitbook.io/chzzk/chzzk-api/session), [CHZZK Authorization](https://chzzk.gitbook.io/chzzk/chzzk-api/authorization), [Paper plugin.yml](https://docs.papermc.io/paper/dev/plugin-yml/), [Spigot Objective](https://hub.spigotmc.org/javadocs/bukkit/org/bukkit/scoreboard/Objective.html).
