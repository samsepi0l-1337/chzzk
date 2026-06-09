# CHZZK Donation Minecraft

CHZZK 실시간 후원을 Minecraft Paper 1.21.1 서버 게임 효과로 연결하는 배포판입니다.

**사용 가이드:** [https://samsepi0l-1337.github.io/chzzk/](https://samsepi0l-1337.github.io/chzzk/)

이 저장소 `main`에는 난독화된 실행 파일만 포함됩니다. 소스 코드는 공개되지 않으며 수정·재배포를 지원하지 않습니다.

## 요구 사항

- Docker 및 Docker Compose
- CHZZK Developers 앱 (Client ID / Secret)
- Minecraft EULA 동의

## 빠른 시작

```bash
cp .env.example .env
# EULA, CHZZK_CLIENT_ID, CHZZK_CLIENT_SECRET, CHZZK_CHANNEL_ID, MINECRAFT_WEBHOOK_SECRET 설정

docker compose -f docker-compose.yml up --build
```

첫 기동 전 CHZZK OAuth 토큰이 필요합니다. 컨테이너 밖에서 한 번 실행하세요:

```bash
cd bridge
npm ci
npm run auth:login -- --env-file ../.env
```

토큰은 `bridge-data` volume의 `.chzzk-tokens.json`에 저장됩니다.

게임 접속 후:

```
/chzzk target set <플레이어>
```

## 채팅 테스트

CHZZK 채팅에 `!치지직마크 <금액>`을 입력하면 후원과 동일한 효과를 검증할 수 있습니다. OAuth scope에 「채팅 메시지 조회」가 필요합니다.

## 후원 효과 금액

| 금액(원) | 효과                         |
| -------- | ---------------------------- |
| 1,000    | 랜덤 버프 30초               |
| 2,000    | 랜덤 아이템 1개              |
| 3,000    | 랜덤 몹 1마리                |
| 5,000    | 전투용 몹 1마리              |
| 10,000   | 전투용 몹 3마리              |
| 30,000   | TNT 3~5개                    |
| 50,000   | 랜덤 텔레포트                |
| 100,000  | target 즉사·인벤·레벨 초기화 |

금액은 위 표와 **정확히 일치**해야 효과가 실행됩니다.

## 문제 해결

- **bridge가 기동하지 않음:** `bridge-data`에 token store가 있는지, `.env`의 CHZZK 값이 맞는지 확인하세요.
- **후원이 반영되지 않음:** `CHZZK_CHANNEL_ID`가 방송 채널 ID와 일치하는지, 게임에서 target이 지정됐는지 확인하세요.
- **webhook 오류:** `MINECRAFT_WEBHOOK_SECRET`이 bridge와 Paper 플러그인 runtime config에 동일한지 확인하세요.

자세한 운영 절차는 GitHub Pages 가이드를 참고하세요.

## 릴리스 무결성

release 패키지에는 아래 파일이 포함됩니다.

- `RELEASE_ARTIFACTS_SHA256SUMS.txt`
- `RELEASE_METADATA.txt`
- `artifacts/chzzk-donation.jar`
- `bridge/dist/*.js`
- `web/dist/*`

무결성 확인은 아래 명령으로 수행합니다.

```bash
sha256sum -c RELEASE_ARTIFACTS_SHA256SUMS.txt
```
