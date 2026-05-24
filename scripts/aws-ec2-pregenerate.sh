#!/usr/bin/env bash
set -euo pipefail

AWS_RUNTIME_DIR=${AWS_RUNTIME_DIR:-${HOME:-$PWD}/chzzk-runtime}
PAPER_DIR=${PAPER_DIR:-$AWS_RUNTIME_DIR/paper}
BIN_DIR=${BIN_DIR:-$AWS_RUNTIME_DIR/bin}
LOG_DIR=${LOG_DIR:-$AWS_RUNTIME_DIR/logs}
PAPER_SESSION=${PAPER_SESSION:-chzzk-paper}
AWS_PROCESS_MANAGER=${AWS_PROCESS_MANAGER:-}
PAPER_VERSION=${PAPER_VERSION:-1.21.1}
PREGENERATE_WORLD=${PREGENERATE_WORLD:-world}
PREGENERATE_CENTER_X=${PREGENERATE_CENTER_X:-0}
PREGENERATE_CENTER_Z=${PREGENERATE_CENTER_Z:-0}
PREGENERATE_RADIUS=${PREGENERATE_RADIUS:-1000}
PREGENERATE_SHAPE=${PREGENERATE_SHAPE:-square}
CHUNKY_JAR=${CHUNKY_JAR:-$PAPER_DIR/plugins/Chunky.jar}
CURL_CMD=${CURL_CMD:-curl}
PYTHON_CMD=${PYTHON_CMD:-python3}

log() { printf '[aws-ec2-pregenerate] %s\n' "$1"; }
fail() { printf '[aws-ec2-pregenerate] ERROR: %s\n' "$1" >&2; exit 1; }

select_manager() {
  if [ -n "$AWS_PROCESS_MANAGER" ]; then
    case "$AWS_PROCESS_MANAGER" in
      tmux|screen) ;;
      *) fail "AWS_PROCESS_MANAGER must be tmux or screen" ;;
    esac
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
  fail "tmux or screen is required; run scripts/aws-ec2-bootstrap.sh first"
}

session_running() {
  local manager=$1
  case "$manager" in
    tmux) tmux has-session -t "$PAPER_SESSION" >/dev/null 2>&1 ;;
    screen) screen -ls | grep -Eq "[.]${PAPER_SESSION}[[:space:]]" ;;
  esac
}

send_console_command() {
  local manager=$1
  local command=$2
  case "$manager" in
    tmux) tmux send-keys -t "$PAPER_SESSION" "$command" C-m ;;
    screen) screen -S "$PAPER_SESSION" -X stuff "$(printf '%s\r' "$command")" ;;
  esac
}

start_paper() {
  local manager=$1
  [ -x "$BIN_DIR/start-paper.sh" ] || fail "missing $BIN_DIR/start-paper.sh; run scripts/aws-ec2-deploy.sh first"
  case "$manager" in
    tmux) tmux new-session -d -s "$PAPER_SESSION" "$BIN_DIR/start-paper.sh" ;;
    screen) screen -dmS "$PAPER_SESSION" "$BIN_DIR/start-paper.sh" ;;
  esac
}

rotate_paper_log() {
  mkdir -p "$LOG_DIR"
  [ -f "$LOG_DIR/paper.log" ] || return 0
  mv "$LOG_DIR/paper.log" "$LOG_DIR/paper.log.before-pregen-$(date +%Y%m%d%H%M%S)"
}

stop_paper() {
  local manager=$1
  session_running "$manager" || return 0
  log "Stopping Paper so Chunky can be loaded"
  send_console_command "$manager" stop
  local i
  for i in $(seq 1 90); do
    session_running "$manager" || return 0
    sleep 1
  done
  fail "Paper did not stop within 90 seconds"
}

wait_for_paper_ready() {
  local manager=$1
  local i
  for i in $(seq 1 120); do
    session_running "$manager" || fail "Paper session exited; check $LOG_DIR/paper.log"
    if [ -f "$LOG_DIR/paper.log" ] && tail -n 200 "$LOG_DIR/paper.log" | grep -q 'Done (.*)! For help, type "help"'; then
      return
    fi
    sleep 1
  done
  fail "Paper did not finish startup within 120 seconds; check $LOG_DIR/paper.log"
}

latest_chunky_url() {
  local api_url
  api_url=$(printf 'https://api.modrinth.com/v2/project/chunky/version?loaders=%%5B%%22paper%%22%%5D&game_versions=%%5B%%22%s%%22%%5D' "$PAPER_VERSION")
  "$CURL_CMD" -fsSL "$api_url" | "$PYTHON_CMD" -c '
import json
import sys

versions = json.load(sys.stdin)
for version in versions:
    for file in version.get("files", []):
        if file.get("primary") and file.get("url"):
            print(file["url"])
            raise SystemExit(0)
    for file in version.get("files", []):
        if file.get("url"):
            print(file["url"])
            raise SystemExit(0)
raise SystemExit("no Chunky download URL found")
'
}

download_chunky() {
  mkdir -p "$PAPER_DIR/plugins"
  if [ -f "$CHUNKY_JAR" ]; then
    log "Using existing Chunky plugin: $CHUNKY_JAR"
    return
  fi

  local download_url=${CHUNKY_DOWNLOAD_URL:-}
  if [ -z "$download_url" ]; then
    command -v "$PYTHON_CMD" >/dev/null 2>&1 || fail "$PYTHON_CMD is required to resolve the latest Chunky download"
    log "Resolving latest Chunky plugin for Paper $PAPER_VERSION"
    download_url=$(latest_chunky_url)
  fi

  log "Downloading Chunky plugin"
  "$CURL_CMD" -fsSL "$download_url" -o "$CHUNKY_JAR"
}

manager=$(select_manager)
download_chunky
stop_paper "$manager"
rotate_paper_log
log "Starting Paper with Chunky loaded"
start_paper "$manager"
wait_for_paper_ready "$manager"

log "Sending Chunky pre-generation commands: world=$PREGENERATE_WORLD center=$PREGENERATE_CENTER_X,$PREGENERATE_CENTER_Z shape=$PREGENERATE_SHAPE radius=$PREGENERATE_RADIUS"
send_console_command "$manager" "difficulty easy"
send_console_command "$manager" "chunky world $PREGENERATE_WORLD"
send_console_command "$manager" "chunky center $PREGENERATE_CENTER_X $PREGENERATE_CENTER_Z"
send_console_command "$manager" "chunky shape $PREGENERATE_SHAPE"
send_console_command "$manager" "chunky radius $PREGENERATE_RADIUS"
send_console_command "$manager" "chunky start"

if [ "$manager" = "tmux" ]; then
  log "Pre-generation started. Check progress with: tmux attach -t $PAPER_SESSION"
else
  log "Pre-generation started. Check progress with: screen -r $PAPER_SESSION"
fi
log "Minecraft random TP uses a 1000-block range, so this pre-generates the matching square around the world spawn by default."
