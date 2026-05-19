# Phase 4 Live CHZZK Checklist

Live CHZZK 검증은 credential과 실제 후원이 필요해서 CI에서 자동화하지 않는다.

## Before Starting

- `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_CHANNEL_ID`를 프로세스 환경 변수로 설정한다.
- `MINECRAFT_WEBHOOK_SECRET`은 plugin `config.yml`의 `webhook.shared-secret`과 같아야 한다.
- token store 또는 `CHZZK_REFRESH_TOKEN`을 준비한다.
- Paper webhook health가 `200`을 반환해야 한다.

## Commands

```bash
npm run e2e:health
npm run e2e:check-env
npm --prefix bridge run build
npm --prefix bridge run start
```

## In Game

```text
/chzzk target set <player>
/chzzk target status
```

실제 CHZZK 후원 뒤 bridge 로그에서 `DONATION` 수신과 webhook 전송을 확인하고, Minecraft에서 target 플레이어에게 tier 효과가 적용되는지 확인한다.
