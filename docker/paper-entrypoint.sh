#!/usr/bin/env sh
set -eu

mkdir -p /server/plugins/ChzzkDonation
cp /opt/chzzk-donation.jar /server/plugins/chzzk-donation.jar

if [ "${EULA:-false}" = "true" ] || [ "${EULA:-false}" = "TRUE" ]; then
  printf 'eula=true\n' > /server/eula.txt
else
  printf 'eula=false\n' > /server/eula.txt
  echo "Set EULA=true after accepting the Minecraft EULA to start Paper." >&2
fi

: "${MINECRAFT_WEBHOOK_SECRET:?MINECRAFT_WEBHOOK_SECRET is required}"

cat > /server/plugins/ChzzkDonation/config.yml <<EOF
webhook:
  host: "0.0.0.0"
  port: ${MINECRAFT_WEBHOOK_PORT:-29371}
  path: "${MINECRAFT_WEBHOOK_PATH:-/chzzk/donations}"
  shared-secret: "${MINECRAFT_WEBHOOK_SECRET}"
sidebar:
  enabled: true
teleport:
  radius: 64
EOF

exec "$@"
