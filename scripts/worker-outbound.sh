#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
WORKER_SECRET_VALUE="${WORKER_SECRET:-}"

if [[ -z "$WORKER_SECRET_VALUE" ]]; then
  echo "[worker] thiếu WORKER_SECRET"
  exit 1
fi

if [[ "$MODE" == "dry" ]]; then
  PAYLOAD='{"dryRun":true}'
else
  PAYLOAD='{"dryRun":false}'
fi

curl -sS -X POST "$BASE_URL/api/worker/outbound" \
  -H "x-worker-secret: $WORKER_SECRET_VALUE" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
echo
