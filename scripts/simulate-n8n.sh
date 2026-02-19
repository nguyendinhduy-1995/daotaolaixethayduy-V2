#!/usr/bin/env bash
# =============================================================================
# scripts/simulate-n8n.sh
# Smoke-test all CRM API endpoints that n8n workflows call.
# PASS/FAIL — mỗi endpoint phải 2xx/3xx, nếu không => FAIL.
# =============================================================================
set -euo pipefail

########################################
# CONFIG
########################################
BASE_URL="${BASE_URL:-http://localhost:3000}"
DRY_RUN="${DRY_RUN:-0}"

# Secrets (PHẢI set ENV trước khi chạy, không hardcode)
: "${CRON_SECRET:?❌ missing CRON_SECRET}"
: "${WORKER_SECRET:?❌ missing WORKER_SECRET}"
: "${OPS_SECRET:?❌ missing OPS_SECRET}"
: "${MARKETING_SECRET:?❌ missing MARKETING_SECRET}"
: "${CRM_EMAIL:?❌ missing CRM_EMAIL}"
: "${CRM_PASSWORD:?❌ missing CRM_PASSWORD}"

########################################
# UTILS
########################################
PASS=0
FAIL=0
TOTAL=0
CORR="$(python3 -c 'import uuid; print(uuid.uuid4())')"

req() {
  local name="$1"; shift
  TOTAL=$((TOTAL + 1))
  echo -n "==> [$TOTAL] $name ... "

  local http_code body
  body=$(mktemp)
  http_code=$("$@" -s -o "$body" -w "%{http_code}" 2>/dev/null) || true

  if [[ "$http_code" =~ ^[23] ]]; then
    echo "✅ PASS (HTTP $http_code)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL (HTTP $http_code)"
    echo "   Response: $(head -c 200 "$body")"
    FAIL=$((FAIL + 1))
  fi
  rm -f "$body"
}

########################################
# TEST 1: Auth / Login
########################################
echo "════════════════════════════════════════"
echo " N8N Smoke Test — $(date '+%Y-%m-%d %H:%M:%S')"
echo " BASE_URL: $BASE_URL"
echo " DRY_RUN:  $DRY_RUN"
echo " CORR_ID:  $CORR"
echo "════════════════════════════════════════"
echo

echo "── AUTH ──────────────────────────────"
TOKEN_BODY=$(mktemp)
TOKEN_HTTP=$(curl -s -o "$TOKEN_BODY" -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: $CORR" \
  -d "{\"account\":\"$CRM_EMAIL\",\"password\":\"$CRM_PASSWORD\"}" 2>/dev/null) || true

TOTAL=$((TOTAL + 1))
if [[ "$TOKEN_HTTP" =~ ^[23] ]]; then
  TOKEN=$(python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" < "$TOKEN_BODY" 2>/dev/null || echo "")
  if [[ -n "$TOKEN" ]]; then
    echo "==> [$TOTAL] auth/login ... ✅ PASS (HTTP $TOKEN_HTTP, token OK)"
    PASS=$((PASS + 1))
  else
    echo "==> [$TOTAL] auth/login ... ❌ FAIL (HTTP $TOKEN_HTTP, no token)"
    FAIL=$((FAIL + 1))
    TOKEN=""
  fi
else
  echo "==> [$TOTAL] auth/login ... ❌ FAIL (HTTP $TOKEN_HTTP)"
  echo "   Response: $(head -c 200 "$TOKEN_BODY")"
  FAIL=$((FAIL + 1))
  TOKEN=""
fi
rm -f "$TOKEN_BODY"
echo

########################################
# TEST 2: Cron Daily (01)
########################################
echo "── CRON DAILY (W01) ─────────────────"
req "cron/daily" curl -X POST "$BASE_URL/api/cron/daily" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "X-Correlation-Id: $CORR" \
  -d "{\"force\":true,\"dryRun\":$([ "$DRY_RUN" = "1" ] && echo true || echo false)}"
echo

########################################
# TEST 3: Worker Outbound (05)
########################################
echo "── WORKER OUTBOUND (W05) ────────────"
req "worker/outbound" curl -X POST "$BASE_URL/api/worker/outbound" \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: $WORKER_SECRET" \
  -H "X-Correlation-Id: $CORR" \
  -d '{"batchSize":10,"concurrency":2,"dryRun":true}'
echo

########################################
# TEST 4: Ops Pulse (06)
########################################
echo "── OPS PULSE (W06) ──────────────────"
req "ops/pulse" curl -X POST "$BASE_URL/api/ops/pulse" \
  -H "Content-Type: application/json" \
  -H "x-ops-secret: $OPS_SECRET" \
  -H "X-Correlation-Id: $CORR" \
  -d "{\"role\":\"PAGE\",\"adminScope\":true,\"dateKey\":\"$(date +%F)\",\"metrics\":{\"messagesToday\":10,\"dataToday\":4}}"
echo

########################################
# TEST 5: Marketing Report (03)
########################################
echo "── MARKETING REPORT (W03) ───────────"
req "marketing/report" curl -X POST "$BASE_URL/api/marketing/report" \
  -H "Content-Type: application/json" \
  -H "x-marketing-secret: $MARKETING_SECRET" \
  -H "X-Correlation-Id: $CORR" \
  -d "{\"date\":\"$(date +%F)\",\"source\":\"meta_ads\",\"spendVnd\":0,\"messages\":0,\"branchCode\":\"HCM1\",\"meta\":{\"campaignId\":\"smoke-test\"}}"
echo

########################################
# TEST 6: Leads Stale (07)
########################################
echo "── LEADS STALE (W07) ────────────────"
if [[ -n "$TOKEN" ]]; then
  req "leads/stale" curl -X GET "$BASE_URL/api/leads/stale?page=1&pageSize=20" \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Correlation-Id: $CORR"
else
  echo "==> SKIP leads/stale (no token)"
  TOTAL=$((TOTAL + 1))
  FAIL=$((FAIL + 1))
fi
echo

########################################
# TEST 7: Public Lead (02/08)
########################################
echo "── PUBLIC LEAD (W02/W08) ────────────"
req "public/lead" curl -X POST "$BASE_URL/api/public/lead" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: $CORR" \
  -d '{"fullName":"Smoke Test","phone":"0900000099","province":"HCM","licenseType":"B2","source":"smoke-test"}'
echo

########################################
# RESULTS
########################################
echo "════════════════════════════════════════"
echo " RESULTS: $PASS/$TOTAL PASS, $FAIL FAIL"
echo "════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  echo "❌ SMOKE TEST FAILED"
  exit 1
else
  echo "🎉 ALL PASS"
  exit 0
fi
