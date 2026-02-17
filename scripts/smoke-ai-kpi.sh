#!/usr/bin/env bash
set -euo pipefail

BASE="http://127.0.0.1:3000"
LOGIN_JSON=$(curl -sS -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"Nguyendinhduy","password":"Nguyendinhduy@95"}')
TOKEN=$(echo "$LOGIN_JSON" | node -pe 'const o=JSON.parse(require("fs").readFileSync(0,"utf8")); o.accessToken||o.token||""')
if [ -z "$TOKEN" ]; then
  echo "LOGIN_FAIL"
  echo "$LOGIN_JSON"
  exit 1
fi

echo "TOKEN_LEN=${#TOKEN}"

BRANCH_JSON=$(curl -sS "$BASE/api/admin/branches" -H "Authorization: Bearer $TOKEN")
BRANCH=$(echo "$BRANCH_JSON" | node -pe 'const o=JSON.parse(require("fs").readFileSync(0,"utf8")); (o.items&&o.items[0]&&o.items[0].id)||""')
echo "BRANCH=$BRANCH"

printf "\n-- kpi targets upsert --\n"
curl -sS -i -X POST "$BASE/api/kpi/targets" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"branchId\":\"$BRANCH\",\"items\":[{\"role\":\"telesales\",\"metricKey\":\"called_daily\",\"targetValue\":46,\"dayOfWeek\":null,\"isActive\":true}]}" | sed -n '1,8p'

printf "\n-- goals daily upsert --\n"
curl -sS -i -X POST "$BASE/api/goals" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"periodType\":\"DAILY\",\"branchId\":\"$BRANCH\",\"dateKey\":\"2026-02-16\",\"revenueTarget\":60000000,\"dossierTarget\":18,\"costTarget\":14000000}" | sed -n '1,8p'

printf "\n-- goals monthly upsert --\n"
curl -sS -i -X POST "$BASE/api/goals" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"periodType\":\"MONTHLY\",\"branchId\":\"$BRANCH\",\"monthKey\":\"2026-02\",\"revenueTarget\":1400000000,\"dossierTarget\":400,\"costTarget\":320000000}" | sed -n '1,8p'

printf "\n-- ai ingest no token --\n"
curl -sS -i -X POST "$BASE/api/ai/suggestions/ingest" \
  -H 'Idempotency-Key: no-token-test' \
  -H 'Content-Type: application/json' \
  -d '{"source":"n8n","runId":"no-token","suggestions":[]}' | sed -n '1,8p'

TOK=$(grep -E '^SERVICE_TOKEN_ACTIVE=' .env | head -n1 | cut -d= -f2- || true)
if [ -n "$TOK" ]; then
  printf "\n-- ai ingest with token --\n"
  RUN_ID="run-$(date +%s)"
  IDEM="idem-$(date +%s)"
  curl -sS -i -X POST "$BASE/api/ai/suggestions/ingest" \
    -H "x-service-token: $TOK" \
    -H "Idempotency-Key: $IDEM" \
    -H 'Content-Type: application/json' \
    -d "{\"source\":\"n8n\",\"runId\":\"$RUN_ID\",\"suggestions\":[{\"dateKey\":\"2026-02-16\",\"role\":\"telesales\",\"branchId\":\"$BRANCH\",\"scoreColor\":\"YELLOW\",\"title\":\"Smoke ingest\",\"content\":\"Noi dung smoke\"}]}" | sed -n '1,8p'
else
  echo "SERVICE_TOKEN_ACTIVE missing"
fi

LEAD_JSON=$(curl -sS "$BASE/api/leads?page=1&pageSize=1" -H "Authorization: Bearer $TOKEN")
LEAD=$(echo "$LEAD_JSON" | node -pe 'const o=JSON.parse(require("fs").readFileSync(0,"utf8")); (o.items&&o.items[0]&&o.items[0].id)||""')
echo "LEAD=$LEAD"

printf "\n-- outbound jobs --\n"
OUT_IDEM="out-$(date +%s)"
curl -sS -i -X POST "$BASE/api/outbound/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $OUT_IDEM" \
  -H 'Content-Type: application/json' \
  -d "{\"channel\":\"CALL_NOTE\",\"templateKey\":\"remind_schedule\",\"leadId\":\"$LEAD\",\"note\":\"smoke\"}" | sed -n '1,8p'

printf "\n-- ai suggestions list --\n"
curl -sS -i "$BASE/api/ai/suggestions?date=2026-02-16" -H "Authorization: Bearer $TOKEN" | sed -n '1,8p'
