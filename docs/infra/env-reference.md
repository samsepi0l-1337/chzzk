# Environment Reference

환경 변수는 루트 Docker 실행, AWS native 실행, bridge 로컬 실행에 사용된다.

## 루트 `.env.example`

Docker compose 기준 파일:

- `.env.example`

| 변수                           | 필수                       | 기본/예시                         | 사용처                                          |
| ------------------------------ | -------------------------- | --------------------------------- | ----------------------------------------------- |
| `EULA`                         | 예                         | `true`                            | `paper-entrypoint.sh`; Minecraft EULA 수락 여부 |
| `CHZZK_CLIENT_ID`              | 예                         | `your-client-id`                  | bridge CHZZK auth                               |
| `CHZZK_CLIENT_SECRET`          | 예                         | `your-client-secret`              | bridge CHZZK auth                               |
| `CHZZK_CHANNEL_ID`             | 예                         | `target-streamer-channel-id`      | bridge 후원/채팅 이벤트 대상 스트리머 채널 필터 |
| `CHZZK_REDIRECT_URI`           | 아니오                     | `http://127.0.0.1:8080/chzzk/oauth/callback` | `auth:url` / `auth:login` local OAuth callback |
| `CHZZK_AUTH_CALLBACK_BIND_HOST` | 아니오                    | `0.0.0.0` on EC2 public callback  | `auth:login` callback server bind host override |
| `CHZZK_AUTH_PAGE_SECRET`       | `auth:web`만 예            | random secret                     | streamer-facing OAuth login page access secret |
| `CHZZK_AUTH_URL`               | 아니오                     | empty                             | Paper plugin `/chzzk auth`에 직접 표시할 URL override |
| `CHZZK_OPENAPI_BASE_URL`       | 아니오                     | `https://openapi.chzzk.naver.com` | CHZZK API base URL                              |
| `MINECRAFT_WEBHOOK_SECRET`     | 예                         | empty                             | bridge signature와 plugin HMAC 검증             |
| `WEBHOOK_MAX_ATTEMPTS`         | 아니오                     | `3`                               | bridge webhook send retry                       |
| `WEBHOOK_RETRY_DELAY_MS`       | 아니오                     | `500`                             | bridge retry delay                              |
| `WEBHOOK_READY_MAX_ATTEMPTS`   | 아니오                     | `30`                              | bridge webhook readiness retry                  |
| `WEBHOOK_READY_RETRY_DELAY_MS` | 아니오                     | `1000`                            | readiness retry delay                           |

운영에서는 `MINECRAFT_WEBHOOK_SECRET`을 비워두지 않는다. 루트 Docker compose는 `EULA`, `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_CHANNEL_ID`, `MINECRAFT_WEBHOOK_SECRET`이 비어 있으면 config 단계에서 실패한다.

`CHZZK_CHANNEL_ID`는 효과를 실행할 스트리머의 채널 식별자다. CHZZK Session 구독 주체는 OAuth/token이 가리키는 계정이며, bridge는 수신된 `DONATION.channelId` 또는 `CHAT.channelId`가 이 값과 정확히 일치할 때만 plugin webhook을 호출한다. 과거 후원 내역 REST 조회 대상 채널을 지정하는 값은 아니며, 공식 문서상 과거 후원 내역 REST endpoint는 확인되지 않는다.
채팅 테스트 명령 `!치지직마크 <금액>`을 쓰려면 CHZZK Developers OAuth scope에 `후원 조회`와 `채팅 메시지 조회`를 모두 포함해 token store를 다시 만들어야 한다.

`npm run auth:login -- --env-file .env`와 `npm run auth:web -- --env-file .env`는 webhook을 호출하지 않으므로 `MINECRAFT_WEBHOOK_SECRET`을 요구하지 않는다. 두 명령은 `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, OAuth callback `code`를 사용해 access token과 refresh token을 token store에 저장한다. bridge live session 실행은 여전히 `MINECRAFT_WEBHOOK_SECRET`을 요구한다.
AWS native 배포에서는 기본 token store가 `$HOME/chzzk-runtime/bridge/.chzzk-tokens.json`이며 `scripts/aws-ec2-deploy.sh`가 bridge starter에 `CHZZK_TOKEN_STORE`를 설정한다.
EC2에서 직접 OAuth callback을 받을 때는 `CHZZK_REDIRECT_URI=http://<Elastic-IP-or-public-DNS>:8080/chzzk/oauth/callback`로 등록하고 `CHZZK_AUTH_CALLBACK_BIND_HOST=0.0.0.0`을 함께 둔다. 스트리머가 직접 접속하는 `auth:web` 페이지는 `CHZZK_AUTH_PAGE_SECRET`이 일치할 때만 CHZZK 로그인 링크를 보여준다. AWS/Docker Paper runtime config는 `CHZZK_AUTH_URL`이 있으면 그 값을 `/chzzk auth` URL로 쓰고, 없으면 `CHZZK_REDIRECT_URI`와 `CHZZK_AUTH_PAGE_SECRET`에서 `/chzzk/oauth/login?secret=...` URL을 생성한다.

## bridge `.env.example`

bridge 단독 실행 기준 파일:

- `bridge/.env.example`

Windows에서 CMD/PowerShell로 bridge를 띄울 때는 **`.env`를 Node가 자동 로드하지 않는다** (`bridge/src/config.ts`만 사용). 환경 변수 설정 예시는 [windows-local-run.md](windows-local-run.md)를 본다.

추가 변수:

| 변수                    | 기본/예시                                | 의미                                                                   |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `CHZZK_TOKEN_STORE`     | `.chzzk-tokens.json`                     | token JSON 저장 경로                                                   |
| `CHZZK_REDIRECT_URI`    | `http://127.0.0.1:8080/chzzk/oauth/callback` | `auth:url` / `auth:login` local OAuth callback                        |
| `CHZZK_AUTH_CALLBACK_BIND_HOST` | empty                           | public redirect URI를 EC2에서 받을 때 `0.0.0.0`로 bind                 |
| `CHZZK_AUTH_PAGE_SECRET` | empty                                  | `auth:web` 접속 URL 보호용 secret                                      |
| `CHZZK_AUTH_URL`        | empty                                  | Paper plugin `/chzzk auth`에 표시할 URL override                       |
| `CHZZK_CHANNEL_ID`      | `target-streamer-channel-id`             | 필수. 수신 `DONATION`/`CHAT` `channelId` 검증 필터                     |
| `MINECRAFT_WEBHOOK_URL` | `http://127.0.0.1:29371/chzzk/donations` | plugin webhook URL                                                     |
| `MINECRAFT_WEBHOOK_HEALTH_URL` | `MINECRAFT_WEBHOOK_URL + /health` | plugin webhook readiness URL                                           |

루트 Docker 실행에서는 compose가 `CHZZK_TOKEN_STORE=/data/.chzzk-tokens.json`와 `MINECRAFT_WEBHOOK_URL=http://paper:29371/chzzk/donations`를 지정한다.

## plugin config와 연결

plugin config:

- `webhook.shared-secret`은 bridge의 `MINECRAFT_WEBHOOK_SECRET`과 같아야 한다.
- Docker에서는 `paper-entrypoint.sh`가 `MINECRAFT_WEBHOOK_SECRET`로 plugin config를 생성한다. 이 값은 YAML block scalar로 기록되어 큰따옴표와 개행이 포함된 secret도 config 구조를 깨지 않는다.
- AWS native 배포에서는 `scripts/aws-ec2-deploy.sh`가 `MINECRAFT_WEBHOOK_SECRET`로 plugin config를 생성하고 `webhook.host`를 `127.0.0.1`로 제한한다.
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
- `CHZZK_AUTH_PAGE_SECRET`
- `CHZZK_AUTH_CODE`
- `MINECRAFT_WEBHOOK_SECRET`
- token store 파일 내용

실제 값을 커밋하지 않는다. 로그, 테스트 fixture, 문서 예시에는 placeholder만 쓴다.
`CHZZK_AUTH_CALLBACK_BIND_HOST`는 secret이 아니지만, public callback 포트는 security group에서 관리자 IP로 제한한다.

## 변경 시 체크리스트

- 새 env를 추가하면 `.env.example`, `bridge/.env.example`, `docs/infra/env-reference.md`를 같이 수정한다.
- Docker에서 필요한 env면 `docker-compose.yml`과 Dockerfile/entrypoint 사용 여부를 확인한다.
- required env를 추가하면 `bridge/src/config.ts` 테스트를 추가한다.
- plugin config로 전달해야 하면 `docker/paper-entrypoint.sh`도 수정한다.
