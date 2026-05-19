# Phase 1 Plugin Simulate Checklist

Paper 서버와 Minecraft client가 준비된 뒤 게임 채팅 또는 서버 콘솔에서 실행한다.

## Setup

```text
/chzzk target set <player>
/chzzk target status
```

## Tier Commands

```text
/chzzk simulate 1000
/chzzk simulate 2000
/chzzk simulate 3000
/chzzk simulate 5000
/chzzk simulate 10000
/chzzk simulate 30000
/chzzk simulate 50000
/chzzk simulate 100000
```

## Expected Result

각 tier 명령은 `Simulation result: ACCEPTED`를 반환해야 한다.

- `NO_TARGET`: `/chzzk target set <player>`가 빠졌다.
- `TARGET_OFFLINE`: target 플레이어가 접속하지 않았다.
- `UNKNOWN_AMOUNT`: tier 금액과 정확히 일치하지 않는다.
