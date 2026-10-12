#!/usr/bin/env bash
# Pretend to be the Pi: send a heartbeat and upload a photo, so you can test the
# web app before the camera is wired up.
#   bash tools/test-upload.sh path/to/photo.jpg
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
KEY="${DEVICE_KEY:-$(grep '^DEVICE_KEY=' "$(dirname "$0")/../backend/.env" | cut -d= -f2)}"
IMG="${1:?Usage: bash tools/test-upload.sh photo.jpg}"

echo "Heartbeat:"
curl -sS -X POST "$API_URL/api/device/heartbeat" \
  -H "X-Device-Key: $KEY" -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"ip":"127.0.0.1","stream_port":8000,"stream_path":"/stream.mjpg"}'
echo; echo "Upload:"
curl -sS -X POST "$API_URL/api/device/upload" \
  -H "X-Device-Key: $KEY" -H "Accept: application/json" \
  -F "image=@$IMG;type=image/jpeg"
echo
