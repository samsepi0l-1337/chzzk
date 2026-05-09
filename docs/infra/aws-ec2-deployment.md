# AWS EC2 Deployment

이 문서는 CHZZK Donation Minecraft 스택을 단일 EC2 인스턴스에 올릴 때의 인스턴스 선택, 보안 그룹, Docker Compose 실행, 운영 검증 절차를 정리한다.

## 결론

1~2명이 10~15시간만 접속하는 단기 서버라면 기본 추천은 서울 리전(`ap-northeast-2`)의 `t3.large`와 Amazon Linux 2023 `x86_64` AMI다.

선택 이유:

- 10~15시간짜리 이벤트 서버는 장기 CPU credit 고갈 리스크보다 총 비용과 설정 단순성이 더 중요하다.
- 이 저장소는 `paper`와 `bridge` 두 컨테이너를 같은 호스트에서 빌드하고 실행하므로 8 GiB 메모리인 `t3.large`가 4 GiB인 `t3.medium`보다 안전하다.
- 현재 Docker smoke 근거는 x86 런타임에 가깝고, Arm/Graviton 실서비스 smoke는 아직 확인되지 않았다.

비용을 더 줄여야 하면 `t3.medium`을 쓸 수 있다. 다만 Paper 첫 실행, Gradle build, Docker daemon, Node bridge가 동시에 올라가는 초기 구간에서 메모리 여유가 작다. Arm 검증을 직접 할 수 있으면 `t4g.large`가 비용 대비 후보지만, 배포 전 Docker build와 Paper 접속 smoke를 반드시 확인한다.

## Short Event Plan

1. `t3.large` On-Demand 인스턴스를 만든다.
2. Elastic IP는 쓰지 않고 EC2 public IPv4 또는 public DNS로 접속한다.
3. EBS는 `gp3` 20~30 GiB로 만들고, world 보존이 필요 없으면 `DeleteOnTermination=true`로 둔다.
4. Security group은 `22/tcp`와 `25565/tcp`만 연다. `29371/tcp`는 열지 않는다.
5. `docker compose -f docker-compose.yml up -d --build`로 실행한다.
6. 방송/테스트가 끝나면 필요한 world만 백업하고 EC2를 `terminate`한다.

## Instance Recommendation

가격은 2026-05-09에 AWS Price List API의 Seoul `ap-northeast-2`, Linux, Shared tenancy, On-Demand 데이터를 확인했다. Price List publication date는 `2026-05-07T19:29:15Z`다. 아래 비용은 EC2 compute만 계산한 값이며 EBS, public IPv4, data transfer, snapshot 비용은 제외한다.

| 용도 | 인스턴스 | vCPU | Memory | 시간당 | 10시간 | 15시간 | 판단 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 단기 서버 기본값 | `t3.large` | 2 | 8 GiB | `$0.1040` | 약 `$1.04` | 약 `$1.56` | 1~2명 이벤트 서버에 충분하고 8 GiB라 Docker/Paper 초기 실행이 안전하다. |
| 비용 최소안 | `t3.medium` | 2 | 4 GiB | `$0.0520` | 약 `$0.52` | 약 `$0.78` | 가장 싼 x86 후보. build와 Paper 초기 실행에서 메모리 여유가 작을 수 있다. |
| Arm 비용 후보 | `t4g.large` | 2 | 8 GiB | `$0.0832` | 약 `$0.83` | 약 `$1.25` | 더 싸지만 Arm 실서비스 smoke 후 사용한다. |
| 장기/안정 운영 후보 | `m7i.large` | 2 | 8 GiB | `$0.1239` | 약 `$1.24` | 약 `$1.86` | 10~15시간 조건에서는 기본값으로 과하다. 장기 운영이나 burst 회피가 필요할 때만 쓴다. |

이번 조건에서는 `t3.large`를 먼저 선택한다. 비용 차이는 `t3.medium` 대비 15시간 기준 약 `$0.78` 수준이고, 4 GiB 메모리 리스크를 피할 수 있다.

## Region

플레이어가 한국에 있으면 `ap-northeast-2`를 먼저 선택한다. 플레이어가 다른 지역에 있으면 플레이어와 가까운 리전을 선택하고 같은 방식으로 가격을 다시 확인한다.

## Storage

기본 EBS는 `gp3` 20~30 GiB를 사용한다.

- 20 GiB: 10~15시간 단기 이벤트 서버.
- 30 GiB: 여유 있게 잡는 기본값.
- 50 GiB 이상: world가 커지거나 백업 파일을 같은 인스턴스에 잠시 보관할 때.
- `paper-data` Docker volume에는 world, Paper config, plugin state가 남는다.
- `bridge-data` Docker volume에는 CHZZK token store가 남는다.

volume이나 EBS를 삭제하면 world/state/token도 삭제된다. 단기 이벤트 후 world가 필요하면 종료 전에 `paper-data` volume을 tar로 백업한다. world 보존이 필요 없으면 EC2 종료 시 EBS도 함께 삭제한다.

## Network Boundary

이 프로젝트의 운영 경계는 단순하게 유지한다.

| 포트 | 공개 범위 | 이유 |
| --- | --- | --- |
| `22/tcp` | 관리자 IP 또는 EC2 Instance Connect 대역만 | SSH 접속용 |
| `25565/tcp` | Minecraft 접속자 대역. 공개 서버면 `0.0.0.0/0` | Minecraft Java 서버 |
| `29371/tcp` | 공개하지 않음 | plugin webhook. Docker network 내부 전용 |

`docker-compose.yml`도 host에는 `25565:25565`만 publish한다. `bridge`는 Docker 내부 주소인 `http://paper:29371/chzzk/donations`로만 webhook을 보낸다. EC2 security group, OS firewall, compose 파일 어디에서도 `29371`을 인터넷에 열지 않는다.

## Prerequisites

- AWS 계정과 EC2 생성 권한.
- Minecraft EULA를 읽고 수락할 권한. `.env`의 `EULA=true`는 수락 후에만 설정한다.
- CHZZK OpenAPI `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`.
- 첫 token store를 만들 `CHZZK_REFRESH_TOKEN`, 또는 `npm run auth`로 미리 만든 token store.
- repository clone 권한.
- 운영 secret으로 쓸 긴 `MINECRAFT_WEBHOOK_SECRET`.

secret 값은 shell history, 로그, Git commit에 남기지 않는다. 운영 `.env`는 서버에만 두고 `chmod 600 .env`로 보호한다. `.env`와 `.chzzk-tokens.json*`는 커밋 대상이 아니다.

## EC2 Setup

권장 콘솔 설정:

1. Region: `ap-northeast-2`, 또는 플레이어와 가장 가까운 리전.
2. AMI: Amazon Linux 2023 `x86_64`.
3. Instance type: 기본 `t3.large`.
4. Storage: `gp3` 20~30 GiB. world 보존이 필요 없으면 terminate 때 같이 삭제되게 둔다.
5. Public IP: 10~15시간 단기 서버면 Elastic IP 없이 EC2 public IPv4 또는 public DNS를 사용한다. Elastic IP와 public IPv4는 과금 대상이다.
6. Security group:
   - Inbound `22/tcp`: 내 공인 IP `/32`만.
   - Inbound `25565/tcp`: Minecraft 접속 허용 대역.
   - Inbound `29371/tcp`: 추가하지 않는다.
   - Outbound: 기본 all outbound 또는 최소 `80/tcp`, `443/tcp`, DNS, NTP 허용.

AWS CLI로 시작할 때는 최신 AL2023 SSM parameter를 사용한다. 예시는 x86 기본 AMI다.

```bash
aws ec2 run-instances \
  --region ap-northeast-2 \
  --image-id resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --instance-type t3.large \
  --key-name <key-name> \
  --security-group-ids <security-group-id> \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeType":"gp3","VolumeSize":20,"DeleteOnTermination":true}}]'
```

## Host Bootstrap

EC2에 SSH로 접속한 뒤 실행한다.

```bash
sudo dnf update -y
sudo dnf install -y git docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker
docker --version
```

Amazon Linux 2023은 `docker`, `containerd`, `nerdctl` 패키지를 제공한다. Docker Compose plugin은 Docker의 release page에서 현재 운영에 사용할 버전을 확인한 뒤 설치한다. 아래 예시는 2026-05-09 기준 최신 release인 `v5.1.3`이다.

```bash
COMPOSE_VERSION=v5.1.3
COMPOSE_ARCH=$(uname -m)
case "$COMPOSE_ARCH" in
  x86_64) COMPOSE_ARCH=x86_64 ;;
  aarch64) COMPOSE_ARCH=aarch64 ;;
  *) echo "unsupported architecture: $COMPOSE_ARCH" >&2; exit 1 ;;
esac

sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -fsSL \
  "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version
```

## Deploy

repository를 받는다.

```bash
git clone https://github.com/samsepi0l-1337/chzzk.git
cd chzzk
```

`.env`를 만들고 secret을 채운다.

```bash
cp .env.example .env
chmod 600 .env
```

필수 값:

```dotenv
EULA=true
CHZZK_CLIENT_ID=your-client-id
CHZZK_CLIENT_SECRET=your-client-secret
MINECRAFT_WEBHOOK_SECRET=replace-with-a-long-random-secret
```

첫 token store가 없으면 `CHZZK_REFRESH_TOKEN`도 넣는다. token store가 생성된 뒤에는 운영 `.env`에서 refresh token을 제거한다.

```dotenv
CHZZK_REFRESH_TOKEN=your-refresh-token
```

첫 실행:

```bash
docker compose -f docker-compose.yml up -d --build
```

첫 실행에서 `paper`는 Paper jar remap과 world generation 때문에 healthcheck 통과까지 오래 걸릴 수 있다. compose는 `paper`가 healthy가 된 뒤 `bridge`를 시작한다.

## Verify

컨테이너 상태:

```bash
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs --tail=100 paper
docker compose -f docker-compose.yml logs --tail=100 bridge
```

plugin webhook healthcheck는 `paper` 컨테이너 안에서 확인한다.

```bash
docker compose -f docker-compose.yml exec paper \
  curl -fsS http://127.0.0.1:29371/chzzk/donations/health
```

host 공개 포트 확인:

```bash
ss -ltnp | grep -E ':(25565|29371)\b' || true
```

기대값:

- `25565`는 외부 접속을 위해 listen된다.
- `29371`은 host에서 listen되지 않아야 하고 security group에도 열려 있지 않아야 한다.

외부 클라이언트에서 Minecraft 주소는 Elastic IP 또는 public DNS의 `25565`로 접속한다.

운영 테스트:

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
docker compose -f docker-compose.yml up -d --build
```

변경 전 백업:

```bash
docker compose -f docker-compose.yml stop
docker run --rm -v chzzk_paper-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/paper-data-backup.tgz -C /data .
docker run --rm -v chzzk_bridge-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/bridge-data-backup.tgz -C /data .
docker compose -f docker-compose.yml up -d --build
```

Compose project name을 바꾸면 volume 이름도 달라질 수 있다. `docker volume ls`로 실제 volume 이름을 확인한 뒤 백업한다.

## Shutdown

10~15시간 이벤트가 끝났고 world 보존이 필요 없으면 인스턴스를 `terminate`한다. 단순 `stop`은 compute 비용은 멈추지만 EBS와 public IPv4 관련 비용이 남을 수 있다.

world나 token store를 남길 때만 먼저 백업한다.

```bash
docker compose -f docker-compose.yml stop
docker run --rm -v chzzk_paper-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/paper-data-final.tgz -C /data .
docker run --rm -v chzzk_bridge-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/bridge-data-final.tgz -C /data .
```

백업을 로컬이나 S3 등 외부 위치로 옮긴 뒤 EC2를 terminate한다.

## Scale Signals

다음이면 인스턴스를 올린다.

- Paper log에 tick lag 또는 `Can't keep up!`가 반복된다.
- CPU credit balance가 낮아지고 회복되지 않는다. T 계열에서 특히 확인한다.
- Java heap을 1 GiB보다 키워야 한다.
- 동시 접속자, view distance, plugin, world 크기가 늘었다.

업그레이드 순서:

1. `t3.medium`을 쓰고 있으면 `t3.large`로 이동한다.
2. `t3.large`에서 1~2명인데도 lag가 반복되면 view distance, plugin 상태, 로그를 먼저 확인한다.
3. 설정 문제가 없고 계속 부족하면 `m7i.large`로 이동한다.
4. Arm 비용 최적화를 원하면 별도 점검 환경에서 `t4g.large` build/run smoke 후 전환한다.

## References

- AWS EC2 instance type selection: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html>
- AWS Price List API offer file used for Seoul pricing: <https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-northeast-2/index.json>
- AWS EC2 security groups: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html>
- AWS security group rule examples: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html>
- AWS Minecraft Java server on EC2 guide: <https://aws.amazon.com/blogs/gametech/setting-up-a-minecraft-java-server-on-amazon-ec2/>
- Amazon Linux 2023 on EC2: <https://docs.aws.amazon.com/linux/al2023/ug/ec2.html>
- Amazon Linux 2023 container runtime packages: <https://docs.aws.amazon.com/linux/al2023/ug/container.html>
- AWS Elastic IP documentation: <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html>
- Amazon EBS volume types: <https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html>
- Docker Compose install overview: <https://docs.docker.com/compose/install/>
