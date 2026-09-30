#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/build-sea.sh [output-name]
# If output-name is not provided, it is auto-detected from the current platform.

PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Normalize platform names
case "${PLATFORM}" in
    mingw*|msys*|cygwin*) PLATFORM="win" ;;
    darwin)               PLATFORM="macos" ;;
    linux)                PLATFORM="linux" ;;
esac

# Normalize arch names
case "${ARCH}" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
esac

# Determine output file name
if [[ -n "${1:-}" ]]; then
    OUTPUT_NAME="$1"
else
    OUTPUT_NAME="waf-${PLATFORM}-${ARCH}"
fi

# Add .exe extension on Windows
if [[ "${PLATFORM}" == "win" ]]; then
    OUTPUT_NAME="${OUTPUT_NAME%.exe}.exe"
fi

mkdir -p bin

# 1. Bundle with esbuild
node scripts/build.js

# 2. Inject version string
bash .github/set_version.sh

# 3. Generate SEA preparation blob
echo "Generating SEA blob..."
node --experimental-sea-config sea-config.json

# 4. Copy the node binary
OUTPUT="bin/${OUTPUT_NAME}"
cp "$(command -v node)" "${OUTPUT}"

# 5. Remove signature on macOS (required before injection)
if [[ "${PLATFORM}" == "macos" ]]; then
    codesign --remove-signature "${OUTPUT}"
fi

# 6. Inject the blob into the binary
echo "Injecting SEA blob into ${OUTPUT}..."
npx postject "${OUTPUT}" NODE_SEA_BLOB sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --overwrite

# 7. Re-sign on macOS
if [[ "${PLATFORM}" == "macos" ]]; then
    codesign --sign - "${OUTPUT}"
fi

# 8. Cleanup
rm -f sea-prep.blob

echo "Built: ${OUTPUT}"
ls -lh "${OUTPUT}"
