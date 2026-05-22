#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}
ENV_FILE=${ENV_FILE:-.env}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:29371/chzzk/donations/health}

log() { printf '[aws-ec2-verify] %s\n' "$1"; }
fail() { printf '[aws-ec2-verify] ERROR: %s\n' "$1" >&2; exit 1; }

host_port_listens() {
  local port=$1
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -Eq "(^|[.:])${port}$"
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi
  fail "ss or lsof is required to verify host ports"
}

cd "$REPO_ROOT"
command -v docker >/dev/null 2>&1 || fail "docker is required"
docker compose version >/dev/null 2>&1 || fail "docker compose is required"
[ -f "$COMPOSE_FILE" ] || fail "missing $COMPOSE_FILE"

compose_cmd=(docker compose)
if [ -f "$ENV_FILE" ]; then
  compose_cmd+=(--env-file "$ENV_FILE")
fi
compose_cmd+=(-f "$COMPOSE_FILE")

log "Checking compose port contract"
config=$("${compose_cmd[@]}" config)
printf '%s\n' "$config" | grep -q 'published: "25565"' || fail "compose does not publish 25565"
if printf '%s\n' "$config" | grep -q 'published: "29371"'; then
  fail "compose must not publish webhook port 29371"
fi

paper_id=$("${compose_cmd[@]}" ps -q paper)
bridge_id=$("${compose_cmd[@]}" ps -q bridge)
[ -n "$paper_id" ] || fail "paper container not found"
[ -n "$bridge_id" ] || fail "bridge container not found"

paper_health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$paper_id")
[ "$paper_health" = "healthy" ] || fail "paper health is $paper_health"

bridge_running=$(docker inspect -f '{{.State.Running}}' "$bridge_id")
[ "$bridge_running" = "true" ] || fail "bridge is not running"

log "Checking plugin webhook from inside paper container"
"${compose_cmd[@]}" exec -T paper curl -fsS "$HEALTH_URL" >/dev/null

log "Checking host port exposure"
host_port_listens 25565 || fail "host port 25565 is not listening"
if host_port_listens 29371; then
  fail "host port 29371 must not be listening"
fi

log "OK: paper healthy, bridge running, 25565 exposed, 29371 internal-only"
