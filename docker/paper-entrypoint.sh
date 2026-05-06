#!/usr/bin/env sh
set -eu

server_dir="${PAPER_SERVER_DIR:-/server}"
plugin_jar="${PAPER_PLUGIN_JAR:-/opt/chzzk-donation.jar}"

if [ "${EULA:-false}" = "true" ] || [ "${EULA:-false}" = "TRUE" ]; then
  : "${MINECRAFT_WEBHOOK_SECRET:?MINECRAFT_WEBHOOK_SECRET is required}"
else
  mkdir -p "$server_dir"
  printf 'eula=false\n' > "$server_dir/eula.txt"
  echo "Set EULA=true after accepting the Minecraft EULA to start Paper." >&2
  exit 1
fi

mkdir -p "$server_dir/plugins/ChzzkDonation"
cp "$plugin_jar" "$server_dir/plugins/chzzk-donation.jar"
printf 'eula=true\n' > "$server_dir/eula.txt"

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
