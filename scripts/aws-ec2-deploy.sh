#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}
ENV_FILE=${ENV_FILE:-.env}

log() { printf '[aws-ec2-deploy] %s\n' "$1"; }
fail() { printf '[aws-ec2-deploy] ERROR: %s\n' "$1" >&2; exit 1; }

read_env_value() {
  local key=$1
  local direct=${!key:-}
  if [ -n "$direct" ]; then
    printf '%s' "$direct"
    return
  fi
  [ -f "$ENV_FILE" ] || return 0
  awk -F= -v key="$key" '
    $0 !~ /^[[:space:]]*#/ && $1 ~ "^[[:space:]]*" key "[[:space:]]*$" {
      value=$0
      sub(/^[^=]*=/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^"|"$/, "", value)
      gsub(/^'\''|'\''$/, "", value)
      print value
      exit
    }
  ' "$ENV_FILE"
}

require_value() {
  local key=$1
  [ -n "$(read_env_value "$key")" ] || fail "$key is required in environment or $ENV_FILE"
}

cd "$REPO_ROOT"
[ -f "$COMPOSE_FILE" ] || fail "missing $COMPOSE_FILE"
[ -f "$ENV_FILE" ] || fail "missing $ENV_FILE; run: cp .env.example .env && chmod 600 .env"
command -v docker >/dev/null 2>&1 || fail "docker is required; run scripts/aws-ec2-bootstrap.sh first"
docker compose version >/dev/null 2>&1 || fail "docker compose is required; run scripts/aws-ec2-bootstrap.sh first"

for key in EULA CHZZK_CLIENT_ID CHZZK_CLIENT_SECRET CHZZK_CHANNEL_ID MINECRAFT_WEBHOOK_SECRET; do
  require_value "$key"
done

case "$(read_env_value EULA | tr '[:upper:]' '[:lower:]')" in
  true) ;;
  *) fail "EULA must be true after accepting the Minecraft EULA" ;;
esac

if [ -z "$(read_env_value CHZZK_REFRESH_TOKEN)" ]; then
  log "CHZZK_REFRESH_TOKEN not set; first live run requires an existing bridge-data token store"
fi

log "Validating compose config"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

log "Building and starting Paper + bridge"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

docker compose -f "$COMPOSE_FILE" ps
log "Done. Verify with: bash scripts/aws-ec2-verify.sh"
