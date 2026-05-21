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

verify_docker_daemon() {
  if docker version >/dev/null 2>&1; then
    return
  fi
  if run_sudo docker version >/dev/null 2>&1; then
    log "Docker daemon is running, but this shell is not in the docker group yet"
    log "Reconnect SSH or run: newgrp docker"
    return
  fi
  fail "Docker daemon is not reachable"
}

install_compose_plugin() {
  if docker compose version >/dev/null 2>&1; then
    log "Docker Compose already installed: $(docker compose version)"
    return
  fi

  local version="${COMPOSE_VERSION:-}"
  if [ -z "$version" ]; then
    version=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest \
      | sed -n 's/.*"tag_name": "\(v[^"]*\)".*/\1/p' \
      | head -n 1)
  fi
  [ -n "$version" ] || fail "Set COMPOSE_VERSION, for example COMPOSE_VERSION=v2.32.4"

  local arch
  arch=$(uname -m)
  case "$arch" in
    x86_64) arch=x86_64 ;;
    aarch64|arm64) arch=aarch64 ;;
    *) fail "unsupported architecture: $arch" ;;
  esac

  local target=/usr/local/lib/docker/cli-plugins/docker-compose
  log "Installing Docker Compose $version for linux-$arch"
  run_sudo mkdir -p /usr/local/lib/docker/cli-plugins
  run_sudo curl -fsSL \
    "https://github.com/docker/compose/releases/download/${version}/docker-compose-linux-${arch}" \
    -o "$target"
  run_sudo chmod +x "$target"
  docker compose version >/dev/null
}

if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  [ "${ID:-}" = "amzn" ] || log "Non-Amazon Linux host detected; continuing with dnf path if available"
fi

command -v dnf >/dev/null 2>&1 || fail "dnf is required; use Amazon Linux 2023 for this runbook"

log "Installing host packages"
run_sudo dnf update -y
run_sudo dnf install -y git docker curl tar

log "Enabling Docker"
run_sudo systemctl enable --now docker

if [ "${EUID:-$(id -u)}" -ne 0 ] && ! id -nG "$(id -un)" | tr ' ' '\n' | grep -qx docker; then
  run_sudo usermod -aG docker "$(id -un)"
  log "Added $(id -un) to docker group; reconnect SSH or run: newgrp docker"
fi

verify_docker_daemon
install_compose_plugin
log "OK: $(docker --version); $(docker compose version)"
