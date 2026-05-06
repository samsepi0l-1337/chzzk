#!/usr/bin/env sh
set -eu

server_dir="${PAPER_SERVER_DIR:-/server}"
plugin_jar="${PAPER_PLUGIN_JAR:-/opt/chzzk-donation.jar}"

: "${MINECRAFT_WEBHOOK_SECRET:?MINECRAFT_WEBHOOK_SECRET is required}"

mkdir -p "$server_dir/plugins/ChzzkDonation"
cp "$plugin_jar" "$server_dir/plugins/chzzk-donation.jar"

if [ "${EULA:-false}" = "true" ] || [ "${EULA:-false}" = "TRUE" ]; then
  printf 'eula=true\n' > "$server_dir/eula.txt"
else
  printf 'eula=false\n' > "$server_dir/eula.txt"
  echo "Set EULA=true after accepting the Minecraft EULA to start Paper." >&2
fi

cat > "$server_dir/plugins/ChzzkDonation/config.yml" <<EOF
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
