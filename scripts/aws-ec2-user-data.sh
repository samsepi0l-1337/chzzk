#!/usr/bin/env bash
set -euo pipefail

dnf update -y
dnf install -y git curl tar java-21-amazon-corretto-headless nodejs npm tmux screen

mkdir -p /opt/chzzk
chown ec2-user:ec2-user /opt/chzzk

mkdir -p /etc/motd.d
cat >/etc/motd.d/chzzk <<'MOTD'
CHZZK host bootstrap is ready.

Next steps:
  git clone <repo-url> ~/chzzk
  cd ~/chzzk
  bash scripts/aws-ec2-bootstrap.sh
  cp .env.example .env
  chmod 600 .env
  bash scripts/aws-ec2-deploy.sh
MOTD
