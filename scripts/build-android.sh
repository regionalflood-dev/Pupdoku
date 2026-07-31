#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEFAULT_JAVA_HOME="/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
DEFAULT_ANDROID_HOME="$HOME/Library/Android/sdk"

export JAVA_HOME="${JAVA_HOME:-$DEFAULT_JAVA_HOME}"
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$DEFAULT_ANDROID_HOME}}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command npm
require_command node
require_command rsync
require_command gradle

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "Java not found at JAVA_HOME: $JAVA_HOME" >&2
  exit 1
fi

if [[ ! -d "$ANDROID_HOME/platforms/android-36" ]]; then
  echo "Android SDK platform 36 not found under: $ANDROID_HOME" >&2
  exit 1
fi

cd "$PROJECT_DIR"

echo "==> Running tests"
npm test

echo "==> Building web assets"
npm run build

echo "==> Syncing web assets into Android"
mkdir -p android/app/src/main/assets
rsync -a --delete dist/ android/app/src/main/assets/

echo "==> Bumping Android app version"
node scripts/bump-android-version.mjs

echo "==> Building debug and release APKs"
gradle -p android :app:assembleDebug :app:assembleRelease --no-daemon

DEBUG_APK="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
RELEASE_APK="$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"
APKSIGNER="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner | sort | tail -n 1)"

if [[ ! -f "$DEBUG_APK" || ! -f "$RELEASE_APK" ]]; then
  echo "Gradle completed, but one or more APK files are missing." >&2
  exit 1
fi

if [[ -z "$APKSIGNER" ]]; then
  echo "apksigner not found under: $ANDROID_HOME/build-tools" >&2
  exit 1
fi

echo "==> Verifying APK signatures"
"$APKSIGNER" verify --verbose "$DEBUG_APK"
"$APKSIGNER" verify --verbose "$RELEASE_APK"

echo "==> APKs ready"
ls -lh "$DEBUG_APK" "$RELEASE_APK"
shasum -a 256 "$DEBUG_APK" "$RELEASE_APK"
