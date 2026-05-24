#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
CONFIG_FILE=${CONFIG_FILE:-config/aws-ec2.env}

log() { printf '[aws-ec2-provision] %s\n' "$1"; }
fail() { printf '[aws-ec2-provision] ERROR: %s\n' "$1" >&2; exit 1; }

load_config() {
  if [ ! -f "$CONFIG_FILE" ]; then
    fail "missing $CONFIG_FILE; copy config/aws-ec2.env.example first"
  fi

  local apply_override_set=false
  local apply_override=
  if [ "${AWS_EC2_APPLY+x}" = "x" ]; then
    apply_override_set=true
    apply_override=$AWS_EC2_APPLY
  fi

  # shellcheck disable=SC1090
  set -a
  . "$CONFIG_FILE"
  set +a

  if [ "$apply_override_set" = "true" ]; then
    AWS_EC2_APPLY=$apply_override
  fi
}

require_value() {
  local key=$1
  local value=${!key:-}
  [ -n "$value" ] || fail "$key is required in $CONFIG_FILE"
}

lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

is_true() {
  [ "$(lower "${1:-false}")" = "true" ]
}

validate_config() {
  AWS_EC2_APPLY=$(lower "${AWS_EC2_APPLY:-false}")
  ALLOW_PUBLIC_SSH=$(lower "${ALLOW_PUBLIC_SSH:-false}")
  ROOT_VOLUME_DELETE_ON_TERMINATION=$(lower "${ROOT_VOLUME_DELETE_ON_TERMINATION:-true}")

  : "${AWS_REGION:=ap-northeast-2}"
  : "${EC2_NAME:=chzzk-minecraft}"
  : "${EC2_INSTANCE_TYPE:=t4g.xlarge}"
  : "${EC2_AMI_ID:=resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64}"
  : "${EC2_SECURITY_GROUP_NAME:=chzzk-minecraft}"
  : "${EC2_ALLOCATE_ELASTIC_IP:=true}"
  : "${EC2_ELASTIC_IP_ALLOCATION_ID:=}"
  : "${SSH_CIDR:=}"
  : "${MINECRAFT_CIDR:=0.0.0.0/0}"
  : "${ROOT_VOLUME_SIZE_GB:=20}"
  : "${EC2_USER_DATA_FILE:=scripts/aws-ec2-user-data.sh}"

  require_value AWS_REGION
  require_value EC2_INSTANCE_TYPE
  require_value EC2_KEY_NAME
  require_value SSH_CIDR
  require_value MINECRAFT_CIDR

  case "$AWS_EC2_APPLY" in true|false) ;; *) fail "AWS_EC2_APPLY must be true or false" ;; esac
  case "$ALLOW_PUBLIC_SSH" in true|false) ;; *) fail "ALLOW_PUBLIC_SSH must be true or false" ;; esac
  case "$(lower "$EC2_ALLOCATE_ELASTIC_IP")" in true|false) EC2_ALLOCATE_ELASTIC_IP=$(lower "$EC2_ALLOCATE_ELASTIC_IP") ;; *) fail "EC2_ALLOCATE_ELASTIC_IP must be true or false" ;; esac
  case "$ROOT_VOLUME_DELETE_ON_TERMINATION" in true|false) ;; *) fail "ROOT_VOLUME_DELETE_ON_TERMINATION must be true or false" ;; esac
  case "$ROOT_VOLUME_SIZE_GB" in ''|*[!0-9]*) fail "ROOT_VOLUME_SIZE_GB must be an integer" ;; esac

  if [ "$SSH_CIDR" = "0.0.0.0/0" ] && ! is_true "$ALLOW_PUBLIC_SSH"; then
    fail "SSH_CIDR=0.0.0.0/0 requires ALLOW_PUBLIC_SSH=true"
  fi

  if [ -n "$EC2_USER_DATA_FILE" ] && [ ! -f "$REPO_ROOT/$EC2_USER_DATA_FILE" ] && [ ! -f "$EC2_USER_DATA_FILE" ]; then
    fail "missing EC2_USER_DATA_FILE: $EC2_USER_DATA_FILE"
  fi
}

run_aws() {
  local base=(aws)
  if [ -n "${AWS_PROFILE:-}" ]; then
    base+=(--profile "$AWS_PROFILE")
  fi
  base+=(--region "$AWS_REGION")
  "${base[@]}" "$@"
}

plan() {
  if is_true "$AWS_EC2_APPLY"; then
    log "Apply mode: AWS API calls will create resources"
  else
    log "Plan only: no AWS API calls made"
    log "Set AWS_EC2_APPLY=true to create resources"
  fi
  log "Region: $AWS_REGION"
  log "Instance: $EC2_INSTANCE_TYPE, AMI: $EC2_AMI_ID, root gp3 ${ROOT_VOLUME_SIZE_GB}GiB"
  log "Elastic IP: $EC2_ALLOCATE_ELASTIC_IP"
  log "Security group: ${EC2_SECURITY_GROUP_ID:-create-or-reuse $EC2_SECURITY_GROUP_NAME}"
  log "Ingress: SSH 22/tcp from $SSH_CIDR; Minecraft 25565/tcp from $MINECRAFT_CIDR"
  log "Webhook 29371/tcp is intentionally not opened"
}

resolve_default_vpc() {
  local vpc_id
  vpc_id=$(run_aws ec2 describe-vpcs \
    --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' \
    --output text)
  [ -n "$vpc_id" ] && [ "$vpc_id" != "None" ] || fail "set EC2_VPC_ID; no default VPC found"
  printf '%s' "$vpc_id"
}

security_group_for_vpc() {
  local vpc_id=$1
  local existing
  existing=$(run_aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$EC2_SECURITY_GROUP_NAME" "Name=vpc-id,Values=$vpc_id" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

  if [ -n "$existing" ] && [ "$existing" != "None" ]; then
    log "Using existing security group: $existing" >&2
    printf '%s' "$existing"
    return
  fi

  log "Creating security group: $EC2_SECURITY_GROUP_NAME" >&2
  run_aws ec2 create-security-group \
    --group-name "$EC2_SECURITY_GROUP_NAME" \
    --description "CHZZK Minecraft server" \
    --vpc-id "$vpc_id" \
    --query GroupId \
    --output text
}

authorize_ingress() {
  local group_id=$1
  local port=$2
  local cidr=$3
  local output

  if output=$(run_aws ec2 authorize-security-group-ingress \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$port" \
    --cidr "$cidr" 2>&1); then
    log "Opened $port/tcp from $cidr"
    return
  fi

  case "$output" in
    *InvalidPermission.Duplicate*) log "Ingress already exists for $port/tcp from $cidr" ;;
    *) printf '%s\n' "$output" >&2; fail "failed to authorize $port/tcp from $cidr" ;;
  esac
}

user_data_arg() {
  [ -n "$EC2_USER_DATA_FILE" ] || return 0
  if [ -f "$REPO_ROOT/$EC2_USER_DATA_FILE" ]; then
    printf 'file://%s/%s' "$REPO_ROOT" "$EC2_USER_DATA_FILE"
    return
  fi
  printf 'file://%s' "$EC2_USER_DATA_FILE"
}

launch_instance() {
  command -v aws >/dev/null 2>&1 || fail "aws CLI is required for apply"

  local vpc_id=${EC2_VPC_ID:-}
  local security_group_id=${EC2_SECURITY_GROUP_ID:-}
  if [ -z "$security_group_id" ]; then
    [ -n "$vpc_id" ] || vpc_id=$(resolve_default_vpc)
    security_group_id=$(security_group_for_vpc "$vpc_id")
  else
    log "Using configured security group: $security_group_id"
  fi

  authorize_ingress "$security_group_id" 22 "$SSH_CIDR"
  authorize_ingress "$security_group_id" 25565 "$MINECRAFT_CIDR"

  local block_device
  block_device=$(printf '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeType":"gp3","VolumeSize":%s,"DeleteOnTermination":%s}}]' \
    "$ROOT_VOLUME_SIZE_GB" \
    "$ROOT_VOLUME_DELETE_ON_TERMINATION")

  local run_args=(
    ec2 run-instances
    --image-id "$EC2_AMI_ID"
    --instance-type "$EC2_INSTANCE_TYPE"
    --key-name "$EC2_KEY_NAME"
    --security-group-ids "$security_group_id"
    --block-device-mappings "$block_device"
    --metadata-options HttpTokens=required,HttpEndpoint=enabled
    --tag-specifications
    "ResourceType=instance,Tags=[{Key=Name,Value=$EC2_NAME},{Key=Project,Value=chzzk}]"
    "ResourceType=volume,Tags=[{Key=Name,Value=$EC2_NAME},{Key=Project,Value=chzzk}]"
  )

  if [ -n "${EC2_SUBNET_ID:-}" ]; then
    run_args+=(--subnet-id "$EC2_SUBNET_ID")
  fi
  if [ -n "${EC2_IAM_INSTANCE_PROFILE:-}" ]; then
    run_args+=(--iam-instance-profile "Name=$EC2_IAM_INSTANCE_PROFILE")
  fi
  local user_data
  user_data=$(user_data_arg)
  if [ -n "$user_data" ]; then
    run_args+=(--user-data "$user_data")
  fi

  log "Launching EC2 instance"
  local instance_id
  instance_id=$(run_aws "${run_args[@]}" --query 'Instances[0].InstanceId' --output text)
  [ -n "$instance_id" ] && [ "$instance_id" != "None" ] || fail "run-instances did not return an instance id"

  log "Waiting for instance-running: $instance_id"
  run_aws ec2 wait instance-running --instance-ids "$instance_id"

  local elastic_ip=
  if is_true "$EC2_ALLOCATE_ELASTIC_IP"; then
    local allocation_id=${EC2_ELASTIC_IP_ALLOCATION_ID:-}
    if [ -z "$allocation_id" ]; then
      log "Allocating Elastic IP"
      allocation_id=$(run_aws ec2 allocate-address \
        --domain vpc \
        --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$EC2_NAME},{Key=Project,Value=chzzk}]" \
        --query AllocationId \
        --output text)
    else
      log "Using configured Elastic IP allocation: $allocation_id"
    fi
    [ -n "$allocation_id" ] && [ "$allocation_id" != "None" ] || fail "allocate-address did not return an allocation id"
    run_aws ec2 associate-address --instance-id "$instance_id" --allocation-id "$allocation_id" >/dev/null
    elastic_ip=$(run_aws ec2 describe-addresses \
      --allocation-ids "$allocation_id" \
      --query 'Addresses[0].PublicIp' \
      --output text)
  fi

  local public_dns
  public_dns=$(run_aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicDnsName' \
    --output text)

  log "Created instance: $instance_id"
  if [ -n "$elastic_ip" ] && [ "$elastic_ip" != "None" ]; then
    log "Elastic IP: $elastic_ip"
    log "Minecraft address: $elastic_ip:25565"
  fi
  log "Public DNS: $public_dns"
  log "Next: ssh -i <key.pem> ec2-user@$public_dns"
}

cd "$REPO_ROOT"
load_config
validate_config
plan

if is_true "$AWS_EC2_APPLY"; then
  launch_instance
fi
