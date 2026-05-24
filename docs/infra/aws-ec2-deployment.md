# AWS EC2 Deployment

이 문서는 CHZZK Donation Minecraft 스택을 단일 EC2 인스턴스에서 **Docker 없이** 실행하는 절차다. EC2 생성은 AWS CLI helper로 준비하고, 런타임은 Paper 서버와 Node bridge를 `tmux` 또는 `screen` detached session으로 띄운다. 기본 목표는 `t4g.xlarge` Graviton 인스턴스로 약 10시간 이벤트성 운영을 하는 것이다.

## 결론

운영 기준:

- Paper/Minecraft는 1.21.1, Java는 21이다.
- EC2는 `t4g.xlarge`와 Amazon Linux 2023 arm64 AMI를 기본값으로 쓴다.
- Elastic IP를 기본 생성/연결한다. Minecraft 접속 주소는 provision 출력의 `<Elastic IP>:25565`다.
- AWS security group은 SSH 관리 포트와 Minecraft `25565/tcp`만 연다.
- plugin webhook `29371/tcp`는 EC2 host의 loopback(`127.0.0.1`) 전용이다. security group에 열지 않는다.
- bridge 기동에는 token store 또는 `CHZZK_REFRESH_TOKEN`이 필요하다.
- 후원 효과 target은 서버 접속 후 `/chzzk target set <player>`로 지정한다.

## Short Event Plan

1. `config/aws-ec2.env.example`을 `config/aws-ec2.env`로 복사하고 `npm run aws:ec2:plan`으로 EC2 계획을 확인한다.
2. 실제 생성 시점에만 `npm run aws:ec2:provision`을 실행한다.
3. EC2에 SSH 접속 후 저장소를 clone하고 `scripts/aws-ec2-bootstrap.sh`를 실행한다.
4. 운영 `.env`를 채우고 `scripts/aws-ec2-deploy.sh`로 Paper와 bridge를 native session으로 시작한다.
5. 이벤트 전 `scripts/aws-ec2-pregenerate.sh`로 랜덤 TP 반경 1000 블록 영역을 미리 생성한다.
6. `scripts/aws-ec2-verify.sh`로 `tmux`/`screen` session, `25565`, loopback `29371`, webhook health를 확인한다.
7. 이벤트 후 `scripts/aws-ec2-backup.sh`로 world와 token store를 백업하고 필요 없으면 EC2를 terminate한다.

## AWS Config

로컬에서 AWS 리소스 설정 파일을 만든다. 이 파일에는 AWS 리소스 설정만 넣고 CHZZK client secret, refresh token, webhook secret은 넣지 않는다.

```bash
cp config/aws-ec2.env.example config/aws-ec2.env
```

필수로 바꿀 값:

```dotenv
EC2_KEY_NAME=your-ec2-key-pair-name
SSH_CIDR=your-public-ip/32
```

기본값:

- `AWS_REGION=ap-northeast-2`
- `EC2_INSTANCE_TYPE=t4g.xlarge`
- `EC2_AMI_ID=resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64`
- `MINECRAFT_CIDR=0.0.0.0/0`
- `ROOT_VOLUME_SIZE_GB=20`
- `EC2_ALLOCATE_ELASTIC_IP=true`
- `AWS_EC2_APPLY=false`

`SSH_CIDR=0.0.0.0/0`은 기본 차단된다. 정말 공개 SSH가 필요한 경우에만 `ALLOW_PUBLIC_SSH=true`를 함께 설정한다.

## EC2 Provision

plan만 확인:

```bash
npm run aws:ec2:plan
```

EC2 생성:

```bash
npm run aws:ec2:provision
```

`scripts/aws-ec2-provision.sh`는 Amazon Linux 2023 SSM parameter, gp3 root volume, IMDSv2 required metadata option을 사용한다. Security group에는 `22/tcp`, `25565/tcp`만 추가하고 `29371/tcp`는 추가하지 않는다. 기본값으로 Elastic IP를 새로 할당하고 인스턴스에 연결한다. 이미 만든 Elastic IP를 재사용하려면 `EC2_ELASTIC_IP_ALLOCATION_ID=eipalloc-...`를 넣는다.
Launch user data는 `scripts/aws-ec2-user-data.sh`를 사용하며, Java/Node/tmux/screen 설치까지만 처리하고 앱 secret은 포함하지 않는다.

생성 성공 후 출력되는 `Minecraft address: <Elastic IP>:25565`가 플레이어 접속 주소다.

## Network Boundary

| 포트 | 바인딩/공개 범위 | 이유 |
| --- | --- | --- |
| `22/tcp` | 관리자 IP 또는 EC2 Instance Connect 대역만 | SSH 접속 |
| `25565/tcp` | Minecraft 접속자 대역. 공개 서버면 `0.0.0.0/0` | Minecraft Java 서버 |
| `29371/tcp` | EC2 host loopback `127.0.0.1` only | bridge -> plugin webhook |

native AWS 배포에서는 Paper plugin config의 `webhook.host`를 `127.0.0.1`로 쓴다. bridge도 같은 host에서 `http://127.0.0.1:29371/chzzk/donations`로 호출한다.

## Host Bootstrap

EC2에 SSH로 접속한 뒤 repository를 받고 bootstrap을 실행한다.

```bash
sudo dnf install -y git
git clone https://github.com/samsepi0l-1337/chzzk.git
cd ~/chzzk
bash scripts/aws-ec2-bootstrap.sh
```

bootstrap은 Amazon Linux 2023에 다음을 설치한다.

- `java-21-amazon-corretto-devel`
- `nodejs`, `npm`
- `git`, `curl`, `tar`, `python3`
- `tmux`, `screen`

`AWS_PROCESS_MANAGER=screen`을 주면 screen을 사용한다. 기본은 tmux가 있으면 tmux, 없으면 screen이다.

## Deploy

EC2의 저장소 루트에서 운영 `.env`를 만든다.

```bash
cp .env.example .env
chmod 600 .env
```

필수 값:

```dotenv
EULA=true
CHZZK_CLIENT_ID=your-client-id
CHZZK_CLIENT_SECRET=your-client-secret
CHZZK_CHANNEL_ID=target-streamer-channel-id
MINECRAFT_WEBHOOK_SECRET=replace-with-a-long-random-secret
```

첫 token store가 없으면 `CHZZK_REFRESH_TOKEN`도 넣는다. bridge가 token store를 만든 뒤에는 운영 `.env`에서 refresh token을 제거한다.

```dotenv
CHZZK_REFRESH_TOKEN=your-refresh-token
```

실행:

```bash
npm run aws:ec2:deploy
npm run aws:ec2:verify
```

`.env` 대신 별도 파일을 쓰면 같은 `ENV_FILE`을 deploy, verify, backup에 넘긴다.

```bash
ENV_FILE=/etc/chzzk/chzzk.env bash scripts/aws-ec2-deploy.sh
ENV_FILE=/etc/chzzk/chzzk.env bash scripts/aws-ec2-verify.sh
ENV_FILE=/etc/chzzk/chzzk.env BACKUP_STOP_STACK=true bash scripts/aws-ec2-backup.sh
```

기본 runtime 경로:

- `AWS_RUNTIME_DIR=$HOME/chzzk-runtime`
- Paper server: `$AWS_RUNTIME_DIR/paper`
- bridge token store: `$AWS_RUNTIME_DIR/bridge/.chzzk-tokens.json`
- starter scripts: `$AWS_RUNTIME_DIR/bin`
- logs: `$AWS_RUNTIME_DIR/logs`

override 가능한 주요 값:

```bash
AWS_PROCESS_MANAGER=screen
PAPER_JAVA_ARGS="-Xms12G -Xmx12G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200"
PAPER_VIEW_DISTANCE=12
PAPER_SIMULATION_DISTANCE=4
PAPER_DIFFICULTY=easy
PAPER_NETWORK_COMPRESSION_THRESHOLD=256
PAPER_USE_NATIVE_TRANSPORT=true
PAPER_CHUNK_IO_THREADS=3
PAPER_CHUNK_WORKER_THREADS=4
PAPER_CHUNK_LOAD_RATE=2400.0
PAPER_CHUNK_SEND_RATE=1800.0
PAPER_CHUNK_GENERATE_RATE=360.0
PAPER_PLAYER_MAX_CONCURRENT_CHUNK_LOADS=96
PAPER_PLAYER_MAX_CONCURRENT_CHUNK_GENERATES=24
PAPER_DELAY_CHUNK_UNLOADS_BY=180s
BRIDGE_NODE_ENV=production
BRIDGE_NODE_OPTIONS="--max-old-space-size=256"
BRIDGE_UV_THREADPOOL_SIZE=2
AWS_RUNTIME_DIR=/srv/chzzk-runtime
```

`t4g.xlarge`는 4 vCPU/16 GiB라 Paper에 12 GiB를 배정하고 OS, bridge, native 메모리 여유를 남긴다. 배포 스크립트는 `paper-global.yml`의 chunk I/O/worker thread와 player chunk load/send/generate rate를 이벤트 서버 기준으로 올리고, `paper-world-defaults.yml`의 chunk unload delay를 늘려 이미 보낸 청크가 더 오래 유지되게 한다. `network-compression-threshold=256`은 원격 접속에서 청크 패킷 전송량을 줄이고, `use-native-transport=true`는 Linux epoll 경로를 명시한다. bridge는 빌드 후 dev dependency를 prune하고 `npm` wrapper 없이 `node dist/index.js`를 `NODE_ENV=production`, 작은 heap, 작은 libuv threadpool로 실행한다. 플러그인은 target이 online일 때 랜덤 목적지 전체를 미리 생성하지 않고 현재 플레이어 주변 청크를 우선 urgent load한다. 랜덤 TP가 발생하면 목적지가 새 현재 위치가 되므로 목적지 주변 청크만 즉시 우선 로딩한다. 완전히 새로 생성되는 랜덤 지형은 항상 1초 로딩을 보장할 수 없으므로, 이벤트 전에는 TP 반경 1000 블록 안의 월드를 미리 생성해 둔다.

## Pre-generate Random TP Area

랜덤 TP는 target 기준 1000 블록 범위를 사용한다. 이벤트 전에 spawn 중심의 `world`에서 같은 반경을 미리 생성한다.

```bash
npm run aws:ec2:pregenerate
```

기본 동작:

- Chunky Paper plugin을 `plugins/Chunky.jar`로 내려받는다.
- Paper를 재시작해 Chunky를 로드한다.
- Paper 콘솔에 `difficulty easy`, `chunky world world`, `chunky center 0 0`, `chunky shape square`, `chunky radius 1000`, `chunky start`를 전송한다.

중심점이나 반경을 바꾸려면:

```bash
PREGENERATE_CENTER_X=120 PREGENERATE_CENTER_Z=-80 PREGENERATE_RADIUS=1000 npm run aws:ec2:pregenerate
```

진행 상황은 Paper session에서 본다.

```bash
tmux attach -t chzzk-paper
```

완료 전에는 이벤트를 시작하지 않는다. 이 단계가 TP 후 첫 블록 표시가 늦는 문제를 줄이는 핵심 작업이다.

## Verify

자동 검증:

```bash
bash scripts/aws-ec2-verify.sh
```

검증 내용:

- Paper session `chzzk-paper` 실행 중.
- bridge session `chzzk-bridge` 실행 중.
- host `25565` listen.
- webhook `29371`은 loopback에서만 listen.
- `http://127.0.0.1:29371/chzzk/donations/health` 응답 성공.

수동 확인:

```bash
tmux ls
tmux attach -t chzzk-paper
tmux attach -t chzzk-bridge
ss -ltnp | grep -E ':(25565|29371)\b' || true
curl -fsS http://127.0.0.1:29371/chzzk/donations/health
```

screen 사용 시:

```bash
screen -ls
screen -r chzzk-paper
screen -r chzzk-bridge
```

Minecraft 접속 후:

```text
/chzzk target set <player>
/chzzk simulate 1000
```

실제 CHZZK 후원 session smoke는 credential과 방송 상태가 필요하므로 자동 검증에 포함하지 않는다.

## Update

코드 갱신:

```bash
cd ~/chzzk
git fetch origin
git checkout main
git pull --ff-only
npm run aws:ec2:deploy
npm run aws:ec2:verify
```

## Backup

live backup:

```bash
npm run aws:ec2:backup
```

consistent backup:

```bash
BACKUP_STOP_STACK=true BACKUP_DIR="$PWD/final-backups" bash scripts/aws-ec2-backup.sh
```

백업 대상:

- `$AWS_RUNTIME_DIR/paper`: world, Paper config, plugin state.
- `$AWS_RUNTIME_DIR/bridge`: CHZZK token store.

`bridge-data` 백업에는 token store secret이 포함될 수 있으므로 `.env`와 같은 수준으로 보호한다.

## Shutdown

약 10시간 이벤트가 끝났고 world 보존이 필요 없으면 EC2를 terminate한다. 단순 stop은 compute 비용은 멈추지만 EBS와 public IPv4 관련 비용이 남을 수 있다.

world나 token store를 남길 때만 먼저 백업한다.

## Scale Signals

다음이면 인스턴스를 올린다.

- Paper log에 tick lag 또는 `Can't keep up!`가 반복된다.
- CPU credit balance가 낮아지고 회복되지 않는다.
- Java heap을 1 GiB보다 키워야 한다.
- 동시 접속자, view distance, plugin, world 크기가 늘었다.

## References

- AWS EC2 instance type selection: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html>
- AWS EC2 security groups: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html>
- AWS security group rule examples: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html>
- AWS CLI `run-instances`: <https://docs.aws.amazon.com/cli/latest/reference/ec2/run-instances.html>
- AWS CLI `authorize-security-group-ingress`: <https://docs.aws.amazon.com/cli/latest/reference/ec2/authorize-security-group-ingress.html>
- Amazon Linux 2023 on EC2: <https://docs.aws.amazon.com/linux/al2023/ug/ec2.html>
- Amazon Linux 2023 package management: <https://docs.aws.amazon.com/linux/al2023/ug/package-management.html>
