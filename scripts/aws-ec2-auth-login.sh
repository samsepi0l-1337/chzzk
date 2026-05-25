#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE=${ENV_FILE:-.env}
AWS_RUNTIME_DIR=${AWS_RUNTIME_DIR:-${HOME:-$REPO_ROOT}/chzzk-runtime}
BRIDGE_DATA_DIR=${BRIDGE_DATA_DIR:-$AWS_RUNTIME_DIR/bridge}
NPM_CMD=${NPM_CMD:-npm}

log() { printf '[aws-ec2-auth-login] %s\n' "$1"; }
fail() { printf '[aws-ec2-auth-login] ERROR: %s\n' "$1" >&2; exit 1; }

absolute_path() {
  case "$1" in
    /*) printf '%s' "$1" ;;
    *) printf '%s/%s' "$REPO_ROOT" "$1" ;;
  esac
}

cd "$REPO_ROOT"
ENV_FILE_PATH=$(absolute_path "$ENV_FILE")
[ -f "$ENV_FILE_PATH" ] || fail "missing ENV_FILE: $ENV_FILE"

mkdir -p "$BRIDGE_DATA_DIR"
chmod 700 "$BRIDGE_DATA_DIR"

log "Installing and building bridge auth CLI"
if [ -f "$REPO_ROOT/bridge/package-lock.json" ]; then
  "$NPM_CMD" --prefix "$REPO_ROOT/bridge" ci
else
  "$NPM_CMD" --prefix "$REPO_ROOT/bridge" install
fi
"$NPM_CMD" --prefix "$REPO_ROOT/bridge" run build

export CHZZK_TOKEN_STORE="${CHZZK_TOKEN_STORE:-$BRIDGE_DATA_DIR/.chzzk-tokens.json}"
log "Starting CHZZK OAuth login; token store will be saved under $CHZZK_TOKEN_STORE"
"$NPM_CMD" --prefix "$REPO_ROOT/bridge" run auth:login -- --env-file "$ENV_FILE_PATH"
chmod 600 "$CHZZK_TOKEN_STORE"
