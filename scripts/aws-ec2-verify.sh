#!/usr/bin/env bash
set -euo pipefail

PAPER_SESSION=${PAPER_SESSION:-chzzk-paper}
BRIDGE_SESSION=${BRIDGE_SESSION:-chzzk-bridge}
AWS_PROCESS_MANAGER=${AWS_PROCESS_MANAGER:-}
CURL_CMD=${CURL_CMD:-curl}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:29371/chzzk/donations/health}

log() { printf '[aws-ec2-verify] %s\n' "$1"; }
fail() { printf '[aws-ec2-verify] ERROR: %s\n' "$1" >&2; exit 1; }

select_manager() {
  if [ -n "$AWS_PROCESS_MANAGER" ]; then
    command -v "$AWS_PROCESS_MANAGER" >/dev/null 2>&1 || fail "$AWS_PROCESS_MANAGER is not installed"
    printf '%s' "$AWS_PROCESS_MANAGER"
    return
  fi
  if command -v tmux >/dev/null 2>&1; then
    printf 'tmux'
    return
  fi
  if command -v screen >/dev/null 2>&1; then
    printf 'screen'
    return
  fi
  fail "tmux or screen is required"
}

session_running() {
  local manager=$1
  local session=$2
  case "$manager" in
    tmux) tmux has-session -t "$session" >/dev/null 2>&1 ;;
    screen) screen -ls | grep -Eq "[.]${session}[[:space:]]" ;;
    *) return 1 ;;
  esac
}

port_listen_addresses() {
  local port=$1
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -E "(^|[.:])${port}$" || true
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN | awk 'NR > 1 {print $9}' || true
    return
  fi
  fail "ss or lsof is required to verify host ports"
}

host_port_listens() {
  [ -n "$(port_listen_addresses "$1")" ]
}

webhook_port_loopback_only() {
  local addresses
  addresses=$(port_listen_addresses 29371)
  [ -n "$addresses" ] || fail "webhook port 29371 is not listening"
  if ! printf '%s\n' "$addresses" | grep -Eq '127\.0\.0\.1:29371|\[::ffff:127\.0\.0\.1\]:29371|\[::1\]:29371|::1:29371|localhost:29371'; then
    fail "webhook port 29371 must listen on loopback"
  fi
  if printf '%s\n' "$addresses" | grep -Eq '0\.0\.0\.0:29371|\*:29371|\[::\]:29371|:::29371'; then
    fail "webhook port 29371 must not listen on all interfaces"
  fi
}

manager=$(select_manager)

session_running "$manager" "$PAPER_SESSION" || fail "paper session is not running: $PAPER_SESSION"
session_running "$manager" "$BRIDGE_SESSION" || fail "bridge session is not running: $BRIDGE_SESSION"

host_port_listens 25565 || fail "host port 25565 is not listening"
webhook_port_loopback_only

"$CURL_CMD" -fsS "$HEALTH_URL" >/dev/null

log "OK: paper and bridge sessions running, 25565 exposed, 29371 loopback-only"
