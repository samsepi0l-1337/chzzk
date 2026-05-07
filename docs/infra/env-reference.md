# Environment Reference

환경 변수는 루트 Docker 실행과 bridge 로컬 실행에 사용된다.

## 루트 `.env.example`

Docker compose 기준 파일:

- `.env.example`

| 변수 | 필수 | 기본/예시 | 사용처 |
| --- | --- | --- | --- |
| `EULA` | 예 | `true` | `paper-entrypoint.sh`; Minecraft EULA 수락 여부 |
| `CHZZK_CLIENT_ID` | 예 | `your-client-id` | bridge CHZZK auth |
| `CHZZK_CLIENT_SECRET` | 예 | `your-client-secret` | bridge CHZZK auth |
| `CHZZK_REFRESH_TOKEN` | 첫 token store가 없으면 예 | empty | bridge 첫 live session token bootstrap |
| `CHZZK_OPENAPI_BASE_URL` | 아니오 | `https://openapi.chzzk.naver.com` | CHZZK API base URL |
| `MINECRAFT_WEBHOOK_SECRET` | 예 | empty | bridge signature와 plugin HMAC 검증 |
| `WEBHOOK_MAX_ATTEMPTS` | 아니오 | `3` | bridge webhook send retry |
| `WEBHOOK_RETRY_DELAY_MS` | 아니오 | `500` | bridge retry delay |
| `WEBHOOK_READY_MAX_ATTEMPTS` | 아니오 | `30` | bridge webhook readiness retry |
| `WEBHOOK_READY_RETRY_DELAY_MS` | 아니오 | `1000` | readiness retry delay |

운영에서는 `MINECRAFT_WEBHOOK_SECRET`을 비워두지 않는다. 루트 Docker compose는 `EULA`, `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `MINECRAFT_WEBHOOK_SECRET`이 비어 있으면 config 단계에서 실패한다.

`npm run auth`로 token을 bootstrap/exchange하는 경로는 webhook을 호출하지 않으므로
`MINECRAFT_WEBHOOK_SECRET`을 요구하지 않는다. bridge live session 실행은 여전히 이 값을 요구한다.
Docker 첫 live session에서 `/data/.chzzk-tokens.json`이 없고 `CHZZK_REFRESH_TOKEN`이 있으면 bridge가 token store를 생성하고 이후 실행에서 재사용한다.

## bridge `.env.example`

bridge 단독 실행 기준 파일:

- `bridge/.env.example`

추가 변수:

| 변수 | 기본/예시 | 의미 |
| --- | --- | --- |
| `CHZZK_TOKEN_STORE` | `.chzzk-tokens.json` | token JSON 저장 경로 |
| `CHZZK_REFRESH_TOKEN` | empty | token store가 없을 때 첫 live session bootstrap에 사용할 refresh token |
| `MINECRAFT_WEBHOOK_URL` | `http://127.0.0.1:29371/chzzk/donations` | plugin webhook URL |

루트 Docker 실행에서는 compose가 `CHZZK_TOKEN_STORE=/data/.chzzk-tokens.json`와 `MINECRAFT_WEBHOOK_URL=http://paper:29371/chzzk/donations`를 지정한다.

## plugin config와 연결

plugin config:

- `webhook.shared-secret`은 bridge의 `MINECRAFT_WEBHOOK_SECRET`과 같아야 한다.
- Docker에서는 `paper-entrypoint.sh`가 `MINECRAFT_WEBHOOK_SECRET`로 plugin config를 생성한다. 이 값은 YAML block scalar로 기록되어 큰따옴표와 개행이 포함된 secret도 config 구조를 깨지 않는다.
- 로컬 Paper 직접 실행에서는 `plugin/src/main/resources/config.yml`이 기본값이므로 서버의 실제 `plugins/ChzzkDonation/config.yml`을 직접 수정해야 한다.

## 숫자 변수 검증

`bridge/src/config.ts`는 숫자 환경 변수를 다음 규칙으로 검증한다.

- `WEBHOOK_MAX_ATTEMPTS`: 양의 정수.
- `WEBHOOK_RETRY_DELAY_MS`: 0 이상 정수.
- `WEBHOOK_READY_MAX_ATTEMPTS`: 양의 정수.
- `WEBHOOK_READY_RETRY_DELAY_MS`: 0 이상 정수.

빈 문자열 또는 undefined는 fallback을 사용한다. 음수, 소수, 숫자가 아닌 값은 에러다.

## Secret 취급

secret 변수:

- `CHZZK_CLIENT_SECRET`
- `CHZZK_REFRESH_TOKEN`
- `CHZZK_AUTH_CODE`
- `MINECRAFT_WEBHOOK_SECRET`
- token store 파일 내용

실제 값을 커밋하지 않는다. 로그, 테스트 fixture, 문서 예시에는 placeholder만 쓴다.

## 변경 시 체크리스트

- 새 env를 추가하면 `.env.example`, `bridge/.env.example`, `docs/infra/env-reference.md`를 같이 수정한다.
- Docker에서 필요한 env면 `docker-compose.yml`과 Dockerfile/entrypoint 사용 여부를 확인한다.
- required env를 추가하면 `bridge/src/config.ts` 테스트를 추가한다.
- plugin config로 전달해야 하면 `docker/paper-entrypoint.sh`도 수정한다.
