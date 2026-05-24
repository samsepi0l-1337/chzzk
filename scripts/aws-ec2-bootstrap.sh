#!/usr/bin/env bash
set -euo pipefail

log() { printf '[aws-ec2-bootstrap] %s\n' "$1"; }
fail() { printf '[aws-ec2-bootstrap] ERROR: %s\n' "$1" >&2; exit 1; }
run_sudo() {
  if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  [ "${ID:-}" = "amzn" ] || log "Non-Amazon Linux host detected; continuing with dnf path if available"
fi

command -v dnf >/dev/null 2>&1 || fail "dnf is required; use Amazon Linux 2023 for this runbook"

log "Installing native host packages"
run_sudo dnf update -y
run_sudo dnf install -y git curl-minimal tar python3 java-21-amazon-corretto-devel nodejs npm tmux screen

java -version >/dev/null
node --version >/dev/null
npm --version >/dev/null

if command -v tmux >/dev/null 2>&1; then
  log "tmux available: $(tmux -V)"
fi
if command -v screen >/dev/null 2>&1; then
  log "screen available"
fi

log "OK: Java 21, Node/npm, tmux/screen native runtime ready"
