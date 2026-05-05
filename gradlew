#!/usr/bin/env sh
set -eu

APP_HOME=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
GRADLE_VERSION=9.2.1
DIST_NAME="gradle-${GRADLE_VERSION}-bin"
DIST_ROOT="${APP_HOME}/.gradle/wrapper/dists/${DIST_NAME}"
GRADLE_HOME="${DIST_ROOT}/gradle-${GRADLE_VERSION}"

if [ ! -x "${GRADLE_HOME}/bin/gradle" ]; then
  mkdir -p "${DIST_ROOT}"
  ZIP_PATH="${DIST_ROOT}/${DIST_NAME}.zip"
  if [ ! -f "${ZIP_PATH}" ]; then
    curl -fsSL -o "${ZIP_PATH}" "https://services.gradle.org/distributions/${DIST_NAME}.zip"
  fi
  unzip -q "${ZIP_PATH}" -d "${DIST_ROOT}"
fi

exec "${GRADLE_HOME}/bin/gradle" "$@"
