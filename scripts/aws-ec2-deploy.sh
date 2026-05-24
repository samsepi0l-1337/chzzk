#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE=${ENV_FILE:-.env}
AWS_RUNTIME_DIR=${AWS_RUNTIME_DIR:-${HOME:-$REPO_ROOT}/chzzk-runtime}
PAPER_DIR=${PAPER_DIR:-$AWS_RUNTIME_DIR/paper}
BRIDGE_DATA_DIR=${BRIDGE_DATA_DIR:-$AWS_RUNTIME_DIR/bridge}
BIN_DIR=${BIN_DIR:-$AWS_RUNTIME_DIR/bin}
LOG_DIR=${LOG_DIR:-$AWS_RUNTIME_DIR/logs}
PAPER_VERSION=${PAPER_VERSION:-1.21.1}
PAPER_BUILD=${PAPER_BUILD:-133}
PAPER_JAVA_ARGS=${PAPER_JAVA_ARGS:--Xms12G -Xmx12G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 -XX:+UseStringDeduplication}
PAPER_VIEW_DISTANCE=${PAPER_VIEW_DISTANCE:-12}
PAPER_SIMULATION_DISTANCE=${PAPER_SIMULATION_DISTANCE:-4}
PAPER_DIFFICULTY=${PAPER_DIFFICULTY:-easy}
PAPER_SYNC_CHUNK_WRITES=${PAPER_SYNC_CHUNK_WRITES:-false}
PAPER_ENTITY_BROADCAST_RANGE=${PAPER_ENTITY_BROADCAST_RANGE:-80}
PAPER_NETWORK_COMPRESSION_THRESHOLD=${PAPER_NETWORK_COMPRESSION_THRESHOLD:-256}
PAPER_USE_NATIVE_TRANSPORT=${PAPER_USE_NATIVE_TRANSPORT:-true}
PAPER_CHUNK_IO_THREADS=${PAPER_CHUNK_IO_THREADS:-3}
PAPER_CHUNK_WORKER_THREADS=${PAPER_CHUNK_WORKER_THREADS:-4}
PAPER_CHUNK_LOAD_RATE=${PAPER_CHUNK_LOAD_RATE:-2400.0}
PAPER_CHUNK_SEND_RATE=${PAPER_CHUNK_SEND_RATE:-1800.0}
PAPER_CHUNK_GENERATE_RATE=${PAPER_CHUNK_GENERATE_RATE:-360.0}
PAPER_PLAYER_MAX_CONCURRENT_CHUNK_LOADS=${PAPER_PLAYER_MAX_CONCURRENT_CHUNK_LOADS:-96}
PAPER_PLAYER_MAX_CONCURRENT_CHUNK_GENERATES=${PAPER_PLAYER_MAX_CONCURRENT_CHUNK_GENERATES:-24}
PAPER_DELAY_CHUNK_UNLOADS_BY=${PAPER_DELAY_CHUNK_UNLOADS_BY:-180s}
PAPER_SESSION=${PAPER_SESSION:-chzzk-paper}
BRIDGE_SESSION=${BRIDGE_SESSION:-chzzk-bridge}
AWS_PROCESS_MANAGER=${AWS_PROCESS_MANAGER:-}
GRADLE_CMD=${GRADLE_CMD:-$REPO_ROOT/gradlew}
NPM_CMD=${NPM_CMD:-npm}
NODE_CMD=${NODE_CMD:-node}
BRIDGE_NODE_ENV=${BRIDGE_NODE_ENV:-production}
BRIDGE_NODE_OPTIONS=${BRIDGE_NODE_OPTIONS:---max-old-space-size=256}
BRIDGE_UV_THREADPOOL_SIZE=${BRIDGE_UV_THREADPOOL_SIZE:-2}
CURL_CMD=${CURL_CMD:-curl}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:29371/chzzk/donations/health}

log() { printf '[aws-ec2-deploy] %s\n' "$1"; }
fail() { printf '[aws-ec2-deploy] ERROR: %s\n' "$1" >&2; exit 1; }

absolute_path() {
  case "$1" in
    /*) printf '%s' "$1" ;;
    *) printf '%s/%s' "$REPO_ROOT" "$1" ;;
  esac
}

read_env_value() {
  local key=$1
  local direct=${!key:-}
  if [ -n "$direct" ]; then
    printf '%s' "$direct"
    return
  fi
  [ -f "$ENV_FILE_PATH" ] || return 0
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
  ' "$ENV_FILE_PATH"
}

require_value() {
  local key=$1
  [ -n "$(read_env_value "$key")" ] || fail "$key is required in environment or $ENV_FILE"
}

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

stop_session() {
  local manager=$1
  local session=$2
  case "$manager" in
    tmux) tmux kill-session -t "$session" >/dev/null 2>&1 || true ;;
    screen) screen -S "$session" -X quit >/dev/null 2>&1 || true ;;
  esac
}

start_detached() {
  local manager=$1
  local session=$2
  local starter=$3
  stop_session "$manager" "$session"
  case "$manager" in
    tmux) tmux new-session -d -s "$session" "$starter" ;;
    screen) screen -dmS "$session" "$starter" ;;
  esac
}

write_paper_config() {
  local secret
  secret=$(read_env_value MINECRAFT_WEBHOOK_SECRET)
  local secret_file
  secret_file=$(mktemp)
  printf '%s' "$secret" > "$secret_file"

  mkdir -p "$PAPER_DIR/plugins/ChzzkDonation"
  cat > "$PAPER_DIR/plugins/ChzzkDonation/config.yml" <<EOF
webhook:
  host: "127.0.0.1"
  port: 29371
  path: "/chzzk/donations"
  shared-secret: |-
$(sed 's/^/    /' "$secret_file")
sidebar:
  enabled: true
EOF
  rm -f "$secret_file"
}

set_server_property() {
  local key=$1
  local value=$2
  local file=$PAPER_DIR/server.properties
  touch "$file"
  if grep -q "^${key}=" "$file"; then
    sed -i "s/^${key}=.*/${key}=${value}/" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

write_server_properties() {
  set_server_property view-distance "$PAPER_VIEW_DISTANCE"
  set_server_property simulation-distance "$PAPER_SIMULATION_DISTANCE"
  set_server_property difficulty "$PAPER_DIFFICULTY"
  set_server_property sync-chunk-writes "$PAPER_SYNC_CHUNK_WRITES"
  set_server_property entity-broadcast-range-percentage "$PAPER_ENTITY_BROADCAST_RANGE"
  set_server_property network-compression-threshold "$PAPER_NETWORK_COMPRESSION_THRESHOLD"
  set_server_property use-native-transport "$PAPER_USE_NATIVE_TRANSPORT"
}

set_yaml_top_property() {
  local file=$1
  local section=$2
  local key=$3
  local value=$4
  local tmp
  tmp=$(mktemp)
  touch "$file"
  awk -v section="$section" -v key="$key" -v value="$value" '
    BEGIN { in_section = 0; found_section = 0; wrote_key = 0 }
    $0 == section ":" {
      if (in_section && !wrote_key) {
        print "  " key ": " value
      }
      in_section = 1
      found_section = 1
      wrote_key = 0
      print
      next
    }
    in_section && $0 !~ /^ / {
      if (!wrote_key) {
        print "  " key ": " value
        wrote_key = 1
      }
      in_section = 0
    }
    in_section && $0 ~ "^  " key ":" {
      print "  " key ": " value
      wrote_key = 1
      next
    }
    { print }
    END {
      if (!found_section) {
        print section ":"
        print "  " key ": " value
      } else if (in_section && !wrote_key) {
        print "  " key ": " value
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

write_paper_global_config() {
  local file=$PAPER_DIR/config/paper-global.yml
  mkdir -p "$PAPER_DIR/config"
  set_yaml_top_property "$file" chunk-system io-threads "$PAPER_CHUNK_IO_THREADS"
  set_yaml_top_property "$file" chunk-system worker-threads "$PAPER_CHUNK_WORKER_THREADS"
  set_yaml_top_property "$file" chunk-loading-basic player-max-chunk-load-rate "$PAPER_CHUNK_LOAD_RATE"
  set_yaml_top_property "$file" chunk-loading-basic player-max-chunk-send-rate "$PAPER_CHUNK_SEND_RATE"
  set_yaml_top_property "$file" chunk-loading-basic player-max-chunk-generate-rate "$PAPER_CHUNK_GENERATE_RATE"
  set_yaml_top_property "$file" chunk-loading-advanced auto-config-send-distance false
  set_yaml_top_property "$file" chunk-loading-advanced player-max-concurrent-chunk-loads "$PAPER_PLAYER_MAX_CONCURRENT_CHUNK_LOADS"
  set_yaml_top_property "$file" chunk-loading-advanced player-max-concurrent-chunk-generates "$PAPER_PLAYER_MAX_CONCURRENT_CHUNK_GENERATES"
}

write_paper_world_defaults_config() {
  local file=$PAPER_DIR/config/paper-world-defaults.yml
  mkdir -p "$PAPER_DIR/config"
  set_yaml_top_property "$file" chunks delay-chunk-unloads-by "$PAPER_DELAY_CHUNK_UNLOADS_BY"
}

write_starters() {
  local env_source=
  if [ -f "$ENV_FILE_PATH" ]; then
    env_source=". \"$ENV_FILE_PATH\""
  fi

  cat > "$BIN_DIR/start-paper.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$PAPER_DIR"
exec java $PAPER_JAVA_ARGS -jar "$PAPER_DIR/paper.jar" --nogui >> "$LOG_DIR/paper.log" 2>&1
EOF

  cat > "$BIN_DIR/start-bridge.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ -n "$env_source" ]; then
  set -a
  $env_source
  set +a
fi
export CHZZK_TOKEN_STORE="\${CHZZK_TOKEN_STORE:-$BRIDGE_DATA_DIR/.chzzk-tokens.json}"
export MINECRAFT_WEBHOOK_URL="\${MINECRAFT_WEBHOOK_URL:-http://127.0.0.1:29371/chzzk/donations}"
export MINECRAFT_WEBHOOK_HEALTH_URL="\${MINECRAFT_WEBHOOK_HEALTH_URL:-http://127.0.0.1:29371/chzzk/donations/health}"
export NODE_ENV="$BRIDGE_NODE_ENV"
export NODE_OPTIONS="$BRIDGE_NODE_OPTIONS"
export UV_THREADPOOL_SIZE="$BRIDGE_UV_THREADPOOL_SIZE"
cd "$REPO_ROOT/bridge"
exec "$NODE_CMD" "$REPO_ROOT/bridge/dist/index.js" >> "$LOG_DIR/bridge.log" 2>&1
EOF

  chmod 700 "$BIN_DIR/start-paper.sh" "$BIN_DIR/start-bridge.sh"
}

wait_for_health() {
  local attempts=${WEBHOOK_READY_MAX_ATTEMPTS:-90}
  local delay=${WEBHOOK_READY_RETRY_DELAY_MS:-2000}
  local i
  for i in $(seq 1 "$attempts"); do
    if "$CURL_CMD" -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return
    fi
    sleep "$((delay / 1000))"
  done
  fail "Paper webhook not ready at $HEALTH_URL; check $LOG_DIR/paper.log"
}

cd "$REPO_ROOT"
ENV_FILE_PATH=$(absolute_path "$ENV_FILE")

for key in EULA CHZZK_CLIENT_ID CHZZK_CLIENT_SECRET CHZZK_CHANNEL_ID MINECRAFT_WEBHOOK_SECRET; do
  require_value "$key"
done

case "$(read_env_value EULA | tr '[:upper:]' '[:lower:]')" in
  true) ;;
  *) fail "EULA must be true after accepting the Minecraft EULA" ;;
esac

manager=$(select_manager)
mkdir -p "$PAPER_DIR/plugins" "$BRIDGE_DATA_DIR" "$BIN_DIR" "$LOG_DIR"
chmod 700 "$BRIDGE_DATA_DIR" "$BIN_DIR" "$LOG_DIR"

log "Building plugin jar"
"$GRADLE_CMD" --no-daemon :plugin:shadowJar

plugin_jar="$REPO_ROOT/plugin/build/libs/chzzk-donation-0.1.0.jar"
[ -f "$plugin_jar" ] || fail "missing plugin jar: $plugin_jar"

if [ ! -f "$PAPER_DIR/paper.jar" ]; then
  log "Downloading Paper $PAPER_VERSION build $PAPER_BUILD"
  "$CURL_CMD" -fsSL \
    "https://api.papermc.io/v2/projects/paper/versions/${PAPER_VERSION}/builds/${PAPER_BUILD}/downloads/paper-${PAPER_VERSION}-${PAPER_BUILD}.jar" \
    -o "$PAPER_DIR/paper.jar"
fi

cp "$plugin_jar" "$PAPER_DIR/plugins/chzzk-donation.jar"
printf 'eula=true\n' > "$PAPER_DIR/eula.txt"
write_server_properties
write_paper_global_config
write_paper_world_defaults_config
write_paper_config

log "Installing and building bridge"
if [ -f "$REPO_ROOT/bridge/package-lock.json" ]; then
  "$NPM_CMD" --prefix "$REPO_ROOT/bridge" ci
else
  "$NPM_CMD" --prefix "$REPO_ROOT/bridge" install
fi
"$NPM_CMD" --prefix "$REPO_ROOT/bridge" run build
"$NPM_CMD" --prefix "$REPO_ROOT/bridge" prune --omit=dev

write_starters

log "Starting Paper with $manager session $PAPER_SESSION"
start_detached "$manager" "$PAPER_SESSION" "$BIN_DIR/start-paper.sh"
wait_for_health

log "Starting bridge with $manager session $BRIDGE_SESSION"
start_detached "$manager" "$BRIDGE_SESSION" "$BIN_DIR/start-bridge.sh"

log "Done. Verify with: bash scripts/aws-ec2-verify.sh"
