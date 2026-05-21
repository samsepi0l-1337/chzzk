#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}
BACKUP_DIR=${BACKUP_DIR:-$REPO_ROOT/backups}
BACKUP_STOP_STACK=${BACKUP_STOP_STACK:-false}
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-$(basename "$REPO_ROOT" | tr '[:upper:]' '[:lower:]')}

log() { printf '[aws-ec2-backup] %s\n' "$1"; }
fail() { printf '[aws-ec2-backup] ERROR: %s\n' "$1" >&2; exit 1; }

container_volume_for_mount() {
  local service=$1
  local mount=$2
  local fallback=$3
  local container_id
  container_id=$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)
  if [ -n "$container_id" ]; then
    docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$mount\"}}{{.Name}}{{end}}{{end}}" "$container_id"
    return
  fi
  printf '%s' "$fallback"
}

backup_volume() {
  local volume=$1
  local name=$2
  local timestamp=$3
  docker volume inspect "$volume" >/dev/null 2>&1 || fail "missing Docker volume: $volume"
  docker run --rm \
    -v "$volume:/data:ro" \
    -v "$BACKUP_DIR:/backup" \
    alpine tar czf "/backup/${name}-${timestamp}.tgz" -C /data .
  log "Wrote $BACKUP_DIR/${name}-${timestamp}.tgz"
}

cd "$REPO_ROOT"
command -v docker >/dev/null 2>&1 || fail "docker is required"
docker compose version >/dev/null 2>&1 || fail "docker compose is required"
mkdir -p "$BACKUP_DIR"
BACKUP_DIR=$(cd "$BACKUP_DIR" && pwd)

if [ "$BACKUP_STOP_STACK" = "true" ]; then
  log "Stopping stack for consistent backup"
  docker compose -f "$COMPOSE_FILE" stop
else
  log "Backing up live volumes; set BACKUP_STOP_STACK=true for a stopped consistent backup"
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
paper_volume=$(container_volume_for_mount paper /server "${COMPOSE_PROJECT_NAME}_paper-data")
bridge_volume=$(container_volume_for_mount bridge /data "${COMPOSE_PROJECT_NAME}_bridge-data")

backup_volume "$paper_volume" paper-data "$timestamp"
backup_volume "$bridge_volume" bridge-data "$timestamp"

if [ "$BACKUP_STOP_STACK" = "true" ]; then
  log "Restarting stack"
  docker compose -f "$COMPOSE_FILE" up -d
fi

log "Protect bridge-data backup; it can contain CHZZK token store secrets"
