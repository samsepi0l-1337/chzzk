#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
AWS_RUNTIME_DIR=${AWS_RUNTIME_DIR:-${HOME:-$REPO_ROOT}/chzzk-runtime}
PAPER_DIR=${PAPER_DIR:-$AWS_RUNTIME_DIR/paper}
BRIDGE_DATA_DIR=${BRIDGE_DATA_DIR:-$AWS_RUNTIME_DIR/bridge}
BACKUP_DIR=${BACKUP_DIR:-$REPO_ROOT/backups}
BACKUP_STOP_STACK=${BACKUP_STOP_STACK:-false}
AWS_RESTART_CMD=${AWS_RESTART_CMD:-bash "$REPO_ROOT/scripts/aws-ec2-deploy.sh"}
PAPER_SESSION=${PAPER_SESSION:-chzzk-paper}
BRIDGE_SESSION=${BRIDGE_SESSION:-chzzk-bridge}
AWS_PROCESS_MANAGER=${AWS_PROCESS_MANAGER:-}

log() { printf '[aws-ec2-backup] %s\n' "$1"; }
fail() { printf '[aws-ec2-backup] ERROR: %s\n' "$1" >&2; exit 1; }

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
  fail "tmux or screen is required when BACKUP_STOP_STACK=true"
}

stop_session() {
  local manager=$1
  local session=$2
  case "$manager" in
    tmux) tmux kill-session -t "$session" >/dev/null 2>&1 || true ;;
    screen) screen -S "$session" -X quit >/dev/null 2>&1 || true ;;
  esac
}

restart_stack() {
  if [ "$stack_stopped" = "true" ]; then
    log "Restarting native stack"
    eval "$AWS_RESTART_CMD"
  fi
}

backup_dir() {
  local source_dir=$1
  local name=$2
  local timestamp=$3
  [ -d "$source_dir" ] || fail "missing directory: $source_dir"
  tar czf "$BACKUP_DIR/${name}-${timestamp}.tgz" -C "$source_dir" .
  log "Wrote $BACKUP_DIR/${name}-${timestamp}.tgz"
}

mkdir -p "$BACKUP_DIR"
BACKUP_DIR=$(cd "$BACKUP_DIR" && pwd)
stack_stopped=false

if [ "$BACKUP_STOP_STACK" = "true" ]; then
  manager=$(select_manager)
  stack_stopped=true
  trap restart_stack EXIT
  log "Stopping native sessions for consistent backup"
  stop_session "$manager" "$BRIDGE_SESSION"
  stop_session "$manager" "$PAPER_SESSION"
else
  log "Backing up live runtime directories; set BACKUP_STOP_STACK=true for a stopped consistent backup"
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir "$PAPER_DIR" paper "$timestamp"
backup_dir "$BRIDGE_DATA_DIR" bridge-data "$timestamp"

if [ "$BACKUP_STOP_STACK" = "true" ]; then
  restart_stack
  stack_stopped=false
  trap - EXIT
fi

log "Protect bridge-data backup; it can contain CHZZK token store secrets"
