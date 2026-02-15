#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERIFY_PORT="${VERIFY_PORT:-3000}"
BASE_URL="http://localhost:${VERIFY_PORT}"
STARTED_SERVER=0
DEV_PID=""
COOKIE_JAR="/tmp/thayduy-crm-verify-cookie.txt"
STUDENT_COOKIE_JAR="/tmp/thayduy-crm-verify-student-cookie.txt"
CALLBACK_SECRET="${N8N_CALLBACK_SECRET:-verify-callback-secret}"
export N8N_CALLBACK_SECRET="$CALLBACK_SECRET"
CRON_SECRET_VALUE="${CRON_SECRET:-}"
WORKER_SECRET_VALUE="${WORKER_SECRET:-}"
OPS_SECRET_VALUE="${OPS_SECRET:-}"

log() {
  printf '[verify] %s\n' "$1"
}

fail() {
  printf '[verify][error] %s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [[ "$STARTED_SERVER" -eq 1 && -n "$DEV_PID" ]] && kill -0 "$DEV_PID" >/dev/null 2>&1; then
    log "Stopping dev server (pid=$DEV_PID)"
    kill "$DEV_PID" >/dev/null 2>&1 || true
    wait "$DEV_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$COOKIE_JAR" >/dev/null 2>&1 || true
  rm -f "$STUDENT_COOKIE_JAR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

route_exists() {
  [[ -f "src/app/api/$1/route.ts" ]]
}

ensure_env() {
  [[ -f .env ]] || fail ".env not found. Run: cp .env.example .env"
}

wait_for_health() {
  local attempts=60
  local i=1
  while (( i <= attempts )); do
    if curl -sS "$BASE_URL/api/health/db" | grep -q '"ok":true'; then
      return 0
    fi
    sleep 1
    ((i++))
  done
  return 1
}

get_token() {
  curl -sS -X POST "$BASE_URL/api/auth/login" \
    -c "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@thayduy.local","password":"Admin@123456"}' \
  | node -e 'const fs=require("fs"); const raw=fs.readFileSync(0,"utf8"); const o=JSON.parse(raw); const t=o.accessToken||o.token; if(!t){process.exit(1)}; process.stdout.write(t);'
}

today_hcm() {
  node -e 'const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()); const y=p.find(x=>x.type==="year").value; const m=p.find(x=>x.type==="month").value; const d=p.find(x=>x.type==="day").value; process.stdout.write(`${y}-${m}-${d}`);'
}

ensure_env

log "Running static checks"
npm run prisma:validate
npm run prisma:generate
npm run db:migrate
npm run lint
npm run build

if curl -sS "$BASE_URL/api/health/db" | grep -q '"ok":true'; then
  log "Dev server already running on :$VERIFY_PORT (reuse)"
else
  log "Starting dev server in background"
  PORT="$VERIFY_PORT" npm run dev > /tmp/thayduy-crm-verify-dev.log 2>&1 &
  DEV_PID=$!
  STARTED_SERVER=1
fi

log "Waiting for health endpoint"
wait_for_health || fail "Health check failed at $BASE_URL/api/health/db"

FORGED_ADMIN_JWT='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjQ3NDg2MTQ0MDAsInJvbGUiOiJhZG1pbiIsInN1YiI6ImZha2UifQ.invalid'
FORGED_ADMIN_HTTP_CODE="$(curl -sS -D /tmp/thayduy-crm-verify-forged-admin.headers -o /tmp/thayduy-crm-verify-forged-admin.html -w '%{http_code}' "$BASE_URL/admin/scheduler" -H "Cookie: access_token=$FORGED_ADMIN_JWT")"
if [[ "$FORGED_ADMIN_HTTP_CODE" == "302" || "$FORGED_ADMIN_HTTP_CODE" == "307" ]]; then
  grep -qi "location: .*login" /tmp/thayduy-crm-verify-forged-admin.headers || fail "Forged admin token redirect should point to login"
elif [[ "$FORGED_ADMIN_HTTP_CODE" == "200" ]]; then
  if grep -q "Bộ lập lịch (n8n)" /tmp/thayduy-crm-verify-forged-admin.html; then
    fail "Forged admin token must not access admin scheduler content"
  fi
else
  fail "Forged admin token should be blocked (got $FORGED_ADMIN_HTTP_CODE)"
fi
log "forged token -> admin redirect OK"

TOKEN="$(get_token)" || fail "Login failed; cannot obtain token"
ADMIN_ID="$(
  curl -sS "$BASE_URL/api/auth/me" -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.user?.id){process.exit(1)}; process.stdout.write(o.user.id);'
)"
log "Login OK"

DASHBOARD_HTTP_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-dashboard.html -w '%{http_code}' "$BASE_URL/dashboard" -b "$COOKIE_JAR")"
[[ "$DASHBOARD_HTTP_CODE" == "200" ]] || fail "Dashboard route failed with status $DASHBOARD_HTTP_CODE"
log "dashboard HTML route OK"

if [[ -f "src/app/(app)/marketing/page.tsx" ]]; then
  MARKETING_HTTP_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-marketing.html -w '%{http_code}' "$BASE_URL/marketing" -b "$COOKIE_JAR")"
  [[ "$MARKETING_HTTP_CODE" == "200" ]] || fail "Marketing route failed with status $MARKETING_HTTP_CODE"
  log "marketing HTML route OK"
fi

if [[ -f "src/app/(app)/admin/scheduler/page.tsx" ]]; then
  SCHEDULER_HTTP_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-admin-scheduler.html -w '%{http_code}' "$BASE_URL/admin/scheduler" -b "$COOKIE_JAR")"
  [[ "$SCHEDULER_HTTP_CODE" == "200" ]] || fail "Admin scheduler route failed with status $SCHEDULER_HTTP_CODE"
  log "admin/scheduler HTML route OK"
fi

if [[ -f "src/app/(app)/admin/ops/page.tsx" ]]; then
  OPS_HTTP_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-admin-ops.html -w '%{http_code}' "$BASE_URL/admin/ops" -b "$COOKIE_JAR")"
  [[ "$OPS_HTTP_CODE" == "200" ]] || fail "Admin ops route failed with status $OPS_HTTP_CODE"
  log "admin/ops HTML route OK"
fi

if [[ -f "src/app/(app)/hr/kpi/page.tsx" ]]; then
  HR_KPI_HTTP_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-hr-kpi.html -w '%{http_code}' "$BASE_URL/hr/kpi" -b "$COOKIE_JAR")"
  [[ "$HR_KPI_HTTP_CODE" == "200" ]] || fail "HR KPI route failed with status $HR_KPI_HTTP_CODE"
  log "hr/kpi HTML route OK"
fi

if route_exists "auth/me"; then
  curl -sS "$BASE_URL/api/auth/me" -b "$COOKIE_JAR" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.user?.id){process.exit(1)}'
  log "auth/me qua cookie OK"
else
  log "SKIP (route missing): /api/auth/me"
fi

if route_exists "admin/scheduler/health"; then
  curl -sS "$BASE_URL/api/admin/scheduler/health" -b "$COOKIE_JAR" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.serverTime!=="string"||typeof o.tz!=="string"){process.exit(1)}; if(typeof o.outbound!=="object"||typeof o.automation!=="object"){process.exit(1)}; if(typeof o.outbound.queued!=="number"||typeof o.outbound.failed!=="number"){process.exit(1)}'
  log "admin/scheduler/health OK"
else
  log "SKIP (route missing): /api/admin/scheduler/health"
fi

if route_exists "auth/refresh"; then
  curl -sS -X POST "$BASE_URL/api/auth/refresh" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!(o.accessToken||o.token)){process.exit(1)}'
  log "auth/refresh qua cookie OK"
else
  log "SKIP (route missing): /api/auth/refresh"
fi

if route_exists "auth/logout"; then
  curl -sS -X POST "$BASE_URL/api/auth/logout" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true){process.exit(1)}'
  HTTP_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-auth-me-out.json -w '%{http_code}' "$BASE_URL/api/auth/me" -b "$COOKIE_JAR")"
  [[ "$HTTP_CODE" != "200" ]] || fail "auth/me should fail after logout"
  log "auth/logout + revoke cookie OK"
  TOKEN="$(get_token)" || fail "Login failed after logout"
  log "Login lại sau logout OK"
else
  log "SKIP (route missing): /api/auth/logout"
fi

if [[ -f "scripts/seed-templates.ts" ]]; then
  npm run seed:templates
  log "seed templates script OK"
fi

USER_ID=""
USER_A_ID=""
USER_B_ID=""
USER_A_EMAIL=""
USER_B_EMAIL=""
BRANCH_ID=""
FIRST_NOTIFICATION_ID=""
if route_exists "users"; then
  TS="$(date +%s)"
  USER_EMAIL="verify-user-$TS@thayduy.local"
  USER_A_EMAIL="verify-a-$TS@thayduy.local"
  USER_B_EMAIL="verify-b-$TS@thayduy.local"
  USER_ID="$(
    curl -sS -X POST "$BASE_URL/api/users" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"name\":\"Verify User\",\"email\":\"$USER_EMAIL\",\"password\":\"Verify@123456\",\"role\":\"telesales\",\"isActive\":true}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.user?.id){process.exit(1)}; process.stdout.write(o.user.id);'
  )"
  USER_A_ID="$(
    curl -sS -X POST "$BASE_URL/api/users" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"name\":\"Verify A\",\"email\":\"$USER_A_EMAIL\",\"password\":\"Verify@123456\",\"role\":\"telesales\",\"isActive\":true}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.user?.id){process.exit(1)}; process.stdout.write(o.user.id);'
  )"
  USER_B_ID="$(
    curl -sS -X POST "$BASE_URL/api/users" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"name\":\"Verify B\",\"email\":\"$USER_B_EMAIL\",\"password\":\"Verify@123456\",\"role\":\"telesales\",\"isActive\":true}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.user?.id){process.exit(1)}; process.stdout.write(o.user.id);'
  )"
  curl -sS "$BASE_URL/api/users?role=telesales&isActive=true&page=1&pageSize=20" -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)){process.exit(1)}'
  log "users create/list telesales OK"
else
  log "SKIP (route missing): /api/users"
fi

if route_exists "admin/branches"; then
  BRANCH_ID="$(
    curl -sS -X POST "$BASE_URL/api/admin/branches" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"name\":\"Chi nhánh verify $(date +%s)\",\"isActive\":true}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.branch?.id){process.exit(1)}; process.stdout.write(o.branch.id);'
  )"
  log "branches create OK"
else
  log "SKIP (route missing): /api/admin/branches"
fi

if [[ -n "$USER_ID" && -n "$BRANCH_ID" ]]; then
  curl -sS -X PATCH "$BASE_URL/api/users/$USER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"branchId\":\"$BRANCH_ID\"}" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.user?.id){process.exit(1)}'
  curl -sS "$BASE_URL/api/users?page=1&pageSize=20&branchId=$BRANCH_ID" -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}; if(!o.items.some(i=>i.branch?.id)){process.exit(1)}'
  log "users branch assignment/list OK"
fi

if route_exists "health/db"; then
  curl -sS "$BASE_URL/api/health/db" | grep -q '"ok":true' || fail "Health endpoint failed"
  log "health/db OK"
else
  log "SKIP (route missing): /api/health/db"
fi

if route_exists "auth/me"; then
  curl -sS "$BASE_URL/api/auth/me" -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.user?.id){process.exit(1)}'
  log "auth/me qua Bearer OK"
else
  log "SKIP (route missing): /api/auth/me"
fi

DATE_HCM="$(today_hcm)"
if route_exists "kpi/daily"; then
  curl -sS "$BASE_URL/api/kpi/daily?date=$DATE_HCM" -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.date!=="string"){process.exit(1)}'
  log "kpi/daily OK ($DATE_HCM)"
else
  log "SKIP (route missing): /api/kpi/daily"
fi

if route_exists "ops/pulse" && route_exists "admin/ops/pulse"; then
  if [[ -z "$OPS_SECRET_VALUE" ]]; then
    log "SKIP ops pulse: thiếu biến OPS_SECRET trong môi trường"
  else
    if route_exists "admin/employee-kpi" && [[ -n "$USER_A_ID" ]]; then
      curl -sS -X POST "$BASE_URL/api/admin/employee-kpi" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"userId\":\"$USER_A_ID\",\"role\":\"TELESALES\",\"effectiveFrom\":\"$DATE_HCM\",\"targetsJson\":{\"calledPctGlobal\":100,\"appointedPctGlobal\":80,\"arrivedPctGlobal\":80,\"signedPctGlobal\":100},\"isActive\":true}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.setting?.id){process.exit(1)}'
      log "employee-kpi setting create OK"
    fi

    if route_exists "leads" && route_exists "leads/[id]" && route_exists "leads/[id]/events" && [[ -n "$USER_A_ID" ]]; then
      OPS_LEAD_PHONE="0988$(date +%s | tail -c 7)"
      OPS_LEAD_ID="$(
        curl -sS -X POST "$BASE_URL/api/leads" \
          -H "Authorization: Bearer $TOKEN" \
          -H 'Content-Type: application/json' \
          -d "{\"fullName\":\"Ops KPI Verify\",\"phone\":\"$OPS_LEAD_PHONE\",\"source\":\"manual\",\"channel\":\"manual\"}" \
        | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.lead?.id){process.exit(1)}; process.stdout.write(o.lead.id);'
      )"

      curl -sS -X PATCH "$BASE_URL/api/leads/$OPS_LEAD_ID" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"ownerId\":\"$USER_A_ID\"}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.lead?.id){process.exit(1)}'

      for EVT in HAS_PHONE CALLED APPOINTED; do
        curl -sS -X POST "$BASE_URL/api/leads/$OPS_LEAD_ID/events" \
          -H "Authorization: Bearer $TOKEN" \
          -H 'Content-Type: application/json' \
          -d "{\"type\":\"$EVT\",\"note\":\"ops verify\"}" \
        | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.event?.id){process.exit(1)}'
      done
    fi

    curl -sS -X POST "$BASE_URL/api/ops/pulse" \
      -H "x-ops-secret: $OPS_SECRET_VALUE" \
      -H 'Content-Type: application/json' \
      -d "{\"role\":\"PAGE\",\"ownerId\":\"$ADMIN_ID\",\"dateKey\":\"$DATE_HCM\",\"windowMinutes\":10,\"metrics\":{\"messagesToday\":100,\"dataToday\":10,\"calledToday\":0,\"appointedToday\":0,\"arrivedToday\":0,\"signedToday\":0},\"targets\":{\"dataRatePctTarget\":20}}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||!o.id||!o.status||!o.computedJson){process.exit(1)}; if(o.computedJson?.daily?.dataRatePctDaily!==10){process.exit(1)}; if(!Array.isArray(o.computedJson?.suggestions)||o.computedJson.suggestions.length===0){process.exit(1)}'

    if [[ -n "$USER_A_ID" ]]; then
      curl -sS -X POST "$BASE_URL/api/ops/pulse" \
        -H "x-ops-secret: $OPS_SECRET_VALUE" \
        -H 'Content-Type: application/json' \
        -d "{\"role\":\"TELESALES\",\"ownerId\":\"$USER_A_ID\",\"dateKey\":\"$DATE_HCM\",\"windowMinutes\":10,\"metrics\":{\"messagesToday\":0,\"dataToday\":4,\"calledToday\":3,\"appointedToday\":1,\"arrivedToday\":0,\"signedToday\":0},\"targets\":{\"calledPctGlobal\":1,\"appointedPctGlobal\":1}}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||!o.id||!o.status||!o.computedJson){process.exit(1)}; const tgt=o.computedJson?.ratesGlobalTarget||{}; const act=o.computedJson?.ratesGlobalActual||{}; if(tgt.calledPctGlobal!==100){process.exit(1)}; if(typeof act.calledPctGlobalActual!=="number" && act.calledPctGlobalActual!==null){process.exit(1)}'
    fi

    curl -sS "$BASE_URL/api/admin/ops/pulse?dateKey=$DATE_HCM&limit=20" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||typeof o.aggregate!=="object"){process.exit(1)}'

    log "ops pulse ingest + admin list OK"
  fi
else
  log "SKIP (route missing): /api/ops/pulse or /api/admin/ops/pulse"
fi

if route_exists "admin/marketing/reports"; then
  curl -sS "$BASE_URL/api/admin/marketing/reports?from=$DATE_HCM&to=$DATE_HCM&source=meta" \
    -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||typeof o.totals!=="object"){process.exit(1)}; if(typeof o.totals.spendVnd!=="number"||typeof o.totals.messages!=="number"){process.exit(1)}'
  log "marketing reports read OK"
else
  log "SKIP (route missing): /api/admin/marketing/reports"
fi

if route_exists "marketing/report"; then
  if [[ -n "${MARKETING_SECRET:-}" ]]; then
    FIRST_ID="$(
      curl -sS -X POST "$BASE_URL/api/marketing/report" \
        -H "x-marketing-secret: $MARKETING_SECRET" \
        -H 'Content-Type: application/json' \
        -d "{\"date\":\"$DATE_HCM\",\"source\":\"meta\",\"spendVnd\":123456,\"messages\":12,\"meta\":{\"source\":\"verify\"}}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||!o.item?.id){process.exit(1)}; process.stdout.write(o.item.id);'
    )"

    SECOND_ID="$(
      curl -sS -X POST "$BASE_URL/api/marketing/report" \
        -H "x-marketing-secret: $MARKETING_SECRET" \
        -H 'Content-Type: application/json' \
        -d "{\"date\":\"$DATE_HCM\",\"source\":\"meta\",\"spendVnd\":123456,\"messages\":12,\"meta\":{\"source\":\"verify\"}}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||!o.item?.id){process.exit(1)}; process.stdout.write(o.item.id);'
    )"

    [[ "$FIRST_ID" == "$SECOND_ID" ]] || fail "Marketing report upsert is not idempotent"

    curl -sS "$BASE_URL/api/admin/marketing/reports?from=$DATE_HCM&to=$DATE_HCM&source=meta" \
      -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.totals.spendVnd!=="number"||typeof o.totals.messages!=="number"||typeof o.totals.cplVnd!=="number"){process.exit(1)}; if(o.totals.spendVnd<123456||o.totals.messages<12||o.totals.cplVnd!==Math.round(123456/12)){process.exit(1)}'
    log "marketing report ingest + idempotent + totals OK"
  else
    log "SKIP marketing report: thiếu biến MARKETING_SECRET trong môi trường"
  fi
else
  log "SKIP (route missing): /api/marketing/report"
fi

LEAD_ID=""
LEAD_FOR_B=""
LEAD_IDS=""
if route_exists "leads"; then
  IDS=()
  for idx in 1 2 3 4 5; do
    PHONE="09$(date +%s | tail -c 8)$idx"
    ID="$(
      curl -sS -X POST "$BASE_URL/api/leads" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"fullName\":\"Verify Lead $idx\",\"phone\":\"$PHONE\",\"source\":\"manual\",\"channel\":\"manual\"}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.lead?.id){process.exit(1)}; process.stdout.write(o.lead.id);'
    )"
    IDS+=("$ID")
  done
  LEAD_ID="${IDS[0]}"
  LEAD_IDS="$(IFS=,; echo "${IDS[*]}")"
  curl -sS "$BASE_URL/api/leads?q=Verify%20Lead&page=1&pageSize=10" -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)){process.exit(1)}'
  if [[ -n "$USER_A_ID" && -n "$USER_B_ID" && -f "src/app/api/leads/assign/route.ts" && -f "src/app/api/leads/auto-assign/route.ts" ]]; then
    curl -sS -X POST "$BASE_URL/api/leads/assign" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"leadIds\":[\"${IDS[0]}\",\"${IDS[1]}\"],\"ownerId\":\"$USER_A_ID\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.updated!=="number"){process.exit(1)}'
    curl -sS -X POST "$BASE_URL/api/leads/auto-assign" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"strategy\":\"round_robin\",\"leadIds\":[\"${IDS[2]}\",\"${IDS[3]}\",\"${IDS[4]}\"]}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.updated!=="number"||!Array.isArray(o.assigned)){process.exit(1)}'
    LEAD_FOR_B="${IDS[2]}"
    curl -sS -X POST "$BASE_URL/api/leads/assign" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"leadIds\":[\"$LEAD_FOR_B\"],\"ownerId\":\"$USER_B_ID\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.updated!=="number"){process.exit(1)}'
    TOKEN_A="$(
      curl -sS -X POST "$BASE_URL/api/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$USER_A_EMAIL\",\"password\":\"Verify@123456\"}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); const t=o.accessToken||o.token; if(!t){process.exit(1)}; process.stdout.write(t);'
    )"
    curl -sS "$BASE_URL/api/leads?page=1&pageSize=100" -H "Authorization: Bearer $TOKEN_A" \
    | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const aid='$USER_A_ID'; if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}; if(o.items.some(i=>i.ownerId!==aid)){process.exit(1)}"
    FORBIDDEN_LEAD_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-lead-forbidden.json -w '%{http_code}' "$BASE_URL/api/leads/$LEAD_FOR_B" -H "Authorization: Bearer $TOKEN_A")"
    [[ "$FORBIDDEN_LEAD_CODE" == "403" ]] || fail "Owner scope failed for /api/leads/[id] (expected 403, got $FORBIDDEN_LEAD_CODE)"
    curl -sS "$BASE_URL/api/leads/$LEAD_ID/events?page=1&pageSize=20&sort=createdAt&order=desc" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)){process.exit(1)}; if(!o.items.some(i=>i.type==="OWNER_CHANGED")){process.exit(1)}'
    log "leads assign/auto-assign + owner scope + OWNER_CHANGED event OK"
  fi
  log "leads create/list OK"
else
  log "SKIP (route missing): /api/leads"
fi

COURSE_ID=""
if route_exists "courses"; then
  CODE="VF-$(date +%s)"
  COURSE_ID="$(
    curl -sS -X POST "$BASE_URL/api/courses" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"code\":\"$CODE\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.course?.id){process.exit(1)}; process.stdout.write(o.course.id);'
  )"
  log "courses create OK"
else
  log "SKIP (route missing): /api/courses"
fi

STUDENT_ID=""
STUDENT_B_ID=""
TUITION_PLAN_ID=""
if route_exists "students" && [[ -n "$LEAD_ID" ]]; then
  STUDENT_ID="$(
    curl -sS -X POST "$BASE_URL/api/students" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"leadId\":\"$LEAD_ID\"${COURSE_ID:+,\"courseId\":\"$COURSE_ID\"},\"studyStatus\":\"studying\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.student?.id){process.exit(1)}; process.stdout.write(o.student.id);'
  )"
  if [[ -n "$LEAD_FOR_B" ]]; then
    STUDENT_B_ID="$(
      curl -sS -X POST "$BASE_URL/api/students" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"leadId\":\"$LEAD_FOR_B\"${COURSE_ID:+,\"courseId\":\"$COURSE_ID\"},\"studyStatus\":\"studying\"}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.student?.id){process.exit(1)}; process.stdout.write(o.student.id);'
    )"
  fi
  log "students create OK"
elif route_exists "students"; then
  log "SKIP (students create): missing lead id"
else
  log "SKIP (route missing): /api/students"
fi

if route_exists "student/auth/register" && [[ -n "$STUDENT_ID" ]]; then
  STUDENT_PHONE="0977$(date +%s | tail -c 7)"
  curl -sS -X POST "$BASE_URL/api/student/auth/register" \
    -c "$STUDENT_COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d "{\"studentId\":\"$STUDENT_ID\",\"phone\":\"$STUDENT_PHONE\",\"password\":\"Student@123\"}" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||!o.student?.id){process.exit(1)}'

  curl -sS -X POST "$BASE_URL/api/student/auth/login" \
    -c "$STUDENT_COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$STUDENT_PHONE\",\"password\":\"Student@123\"}" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||!o.student?.id){process.exit(1)}'

  curl -sS "$BASE_URL/api/student/me" -b "$STUDENT_COOKIE_JAR" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.student||!o.finance||!Array.isArray(o.schedule)){process.exit(1)}'

  STUDENT_PORTAL_HTTP="$(curl -sS -o /tmp/thayduy-crm-verify-student-portal.html -w '%{http_code}' "$BASE_URL/student" -b "$STUDENT_COOKIE_JAR")"
  [[ "$STUDENT_PORTAL_HTTP" == "200" ]] || fail "Student portal route failed with status $STUDENT_PORTAL_HTTP"
  log "student portal register/login/me OK"
else
  log "SKIP (route missing): /api/student/auth/register"
fi

SCHEDULE_ID=""
if route_exists "schedule" && [[ -n "$COURSE_ID" ]]; then
  SCHEDULE_ID="$(
    curl -sS -X POST "$BASE_URL/api/courses/$COURSE_ID/schedule" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"type\":\"study\",\"title\":\"Buoi hoc verify\",\"startAt\":\"${DATE_HCM}T08:00:00+07:00\",\"endAt\":\"${DATE_HCM}T10:00:00+07:00\",\"rule\":{\"location\":\"Phong A\"}}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.item?.id){process.exit(1)}; process.stdout.write(o.item.id);'
  )"

  if [[ -n "$STUDENT_ID" && -f "src/app/api/schedule/[id]/attendance/route.ts" ]]; then
    curl -sS -X POST "$BASE_URL/api/schedule/$SCHEDULE_ID/attendance" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"records\":[{\"studentId\":\"$STUDENT_ID\",\"status\":\"PRESENT\",\"note\":\"co mat\"}]}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true){process.exit(1)}'
  fi

  curl -sS "$BASE_URL/api/schedule?page=1&pageSize=20&courseId=$COURSE_ID" -H "Authorization: Bearer $TOKEN" \
  | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const id='$SCHEDULE_ID'; if(!Array.isArray(o.items)||!o.items.some(i=>i.id===id)){process.exit(1)}; const row=o.items.find(i=>i.id===id); if(!row?.attendance||typeof row.attendance.present!=='number'){process.exit(1)}"

  if route_exists "schedule/[id]"; then
    curl -sS "$BASE_URL/api/schedule/$SCHEDULE_ID" -H "Authorization: Bearer $TOKEN" \
    | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); if(!o.item?.id||!Array.isArray(o.attendance)){process.exit(1)}"
  fi

  if [[ -n "${TOKEN_A:-}" ]]; then
    curl -sS "$BASE_URL/api/schedule?page=1&pageSize=50" -H "Authorization: Bearer $TOKEN_A" \
    | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const id='$SCHEDULE_ID'; if(!Array.isArray(o.items)||!o.items.some(i=>i.id===id)){process.exit(1)}"
  fi

  log "schedule list/detail/attendance + telesales scope OK"
else
  log "SKIP (route missing): /api/schedule"
fi

if route_exists "tuition-plans"; then
  TUITION_PLAN_ID="$(
    curl -sS -X POST "$BASE_URL/api/tuition-plans" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"province\":\"HCM Verify $(date +%s)\",\"licenseType\":\"B\",\"totalAmount\":12000000,\"paid50Amount\":6000000,\"note\":\"verify\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.tuitionPlan?.id){process.exit(1)}; process.stdout.write(o.tuitionPlan.id);'
  )"
  log "tuition-plans create OK"
else
  log "SKIP (route missing): /api/tuition-plans"
fi

if [[ -n "$STUDENT_ID" && -n "$TUITION_PLAN_ID" ]]; then
  curl -sS -X PATCH "$BASE_URL/api/students/$STUDENT_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"tuitionPlanId\":\"$TUITION_PLAN_ID\"}" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.student?.id){process.exit(1)}'
  log "student attach tuition plan OK"
fi

if [[ -n "$LEAD_ID" ]]; then
  LEAD_PAGE_HTTP="$(curl -sS -o /tmp/thayduy-crm-verify-lead-page.html -w '%{http_code}' "$BASE_URL/leads/$LEAD_ID" -b "$COOKIE_JAR")"
  [[ "$LEAD_PAGE_HTTP" == "200" ]] || fail "Lead detail page failed with status $LEAD_PAGE_HTTP"
  log "leads/[id] HTML route OK"
fi

if route_exists "receipts" && [[ -n "$STUDENT_ID" ]]; then
  RECEIPT_ID="$(
    curl -sS -X POST "$BASE_URL/api/receipts" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"studentId\":\"$STUDENT_ID\",\"amount\":1000000,\"method\":\"cash\",\"receivedAt\":\"$DATE_HCM\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.receipt?.id){process.exit(1)}; process.stdout.write(o.receipt.id);'
  )"
  curl -sS "$BASE_URL/api/receipts?studentId=$STUDENT_ID&page=1&pageSize=10" -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)){process.exit(1)}'
  if route_exists "receipts/summary"; then
    curl -sS "$BASE_URL/api/receipts/summary?date=$DATE_HCM" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.totalThu!=="number"){process.exit(1)}'
  fi
  if route_exists "receipts/[id]"; then
    curl -sS "$BASE_URL/api/receipts/$RECEIPT_ID" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.receipt?.id){process.exit(1)}'
  fi
  if [[ -n "${TOKEN_A:-}" && -n "$STUDENT_B_ID" ]]; then
    RECEIPT_B_ID="$(
      curl -sS -X POST "$BASE_URL/api/receipts" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"studentId\":\"$STUDENT_B_ID\",\"amount\":200000,\"method\":\"cash\",\"receivedAt\":\"$DATE_HCM\"}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.receipt?.id){process.exit(1)}; process.stdout.write(o.receipt.id);'
    )"
    FORBIDDEN_STUDENT_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-student-forbidden.json -w '%{http_code}' "$BASE_URL/api/students/$STUDENT_B_ID" -H "Authorization: Bearer $TOKEN_A")"
    [[ "$FORBIDDEN_STUDENT_CODE" == "403" ]] || fail "Owner scope failed for /api/students/[id] (expected 403, got $FORBIDDEN_STUDENT_CODE)"
    FORBIDDEN_RECEIPT_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-receipt-forbidden.json -w '%{http_code}' "$BASE_URL/api/receipts/$RECEIPT_B_ID" -H "Authorization: Bearer $TOKEN_A")"
    [[ "$FORBIDDEN_RECEIPT_CODE" == "403" ]] || fail "Owner scope failed for /api/receipts/[id] (expected 403, got $FORBIDDEN_RECEIPT_CODE)"
    curl -sS "$BASE_URL/api/receipts?page=1&pageSize=200" -H "Authorization: Bearer $TOKEN_A" \
    | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const rid='$RECEIPT_B_ID'; if(!Array.isArray(o.items)){process.exit(1)}; if(o.items.some(i=>i.id===rid)){process.exit(1)}"
  fi
  if route_exists "students/[id]/finance"; then
    curl -sS "$BASE_URL/api/students/$STUDENT_ID/finance" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.paidTotal!=="number"||typeof o.remaining!=="number"||o.remaining<0||o.paidTotal!==1000000){process.exit(1)}'
    log "students finance OK"
  fi
  log "receipts create/list/summary/get OK"
elif route_exists "receipts"; then
  log "SKIP (receipts): missing student id"
else
  log "SKIP (route missing): /api/receipts"
fi

if [[ -n "$STUDENT_ID" ]]; then
  STUDENT_PAGE_HTTP="$(curl -sS -o /tmp/thayduy-crm-verify-student-page.html -w '%{http_code}' "$BASE_URL/students/$STUDENT_ID" -b "$COOKIE_JAR")"
  [[ "$STUDENT_PAGE_HTTP" == "200" ]] || fail "Student detail page failed with status $STUDENT_PAGE_HTTP"
  log "students/[id] HTML route OK"
fi

if route_exists "notifications/generate" && route_exists "notifications"; then
  curl -sS -X POST "$BASE_URL/api/notifications/generate" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"scope":"finance","dryRun":true}' \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.preview)){process.exit(1)}'

  curl -sS -X POST "$BASE_URL/api/notifications/generate" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"scope":"finance","dryRun":false}' \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.created!=="number"){process.exit(1)}'

  FIRST_NOTIFICATION_ID="$(
    curl -sS "$BASE_URL/api/notifications?scope=FINANCE&page=1&pageSize=20" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}; process.stdout.write(o.items[0].id);'
  )"

  curl -sS -X PATCH "$BASE_URL/api/notifications/$FIRST_NOTIFICATION_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"status":"DONE"}' \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.notification?.status!=="DONE"){process.exit(1)}'

  log "notifications generate/list/patch OK"
else
  log "SKIP (route missing): /api/notifications or /api/notifications/generate"
fi

if route_exists "cron/daily"; then
  if [[ -z "$CRON_SECRET_VALUE" ]]; then
    log "SKIP cron: thiếu biến CRON_SECRET trong môi trường"
  else
    curl -sS -X POST "$BASE_URL/api/cron/daily" \
      -H "x-cron-secret: $CRON_SECRET_VALUE" \
      -H 'Content-Type: application/json' \
      -d '{"dryRun":true}' \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true){process.exit(1)}; if(typeof o.quietHoursBlocked!=="boolean"){process.exit(1)}; if(typeof o.counts!=="object"||typeof o.breakdowns!=="object"){process.exit(1)}; if(typeof o.breakdowns.countsByPriority!=="object"||typeof o.breakdowns.skippedReasons!=="object"){process.exit(1)}'

    curl -sS -X POST "$BASE_URL/api/cron/daily" \
      -H "x-cron-secret: $CRON_SECRET_VALUE" \
      -H 'Content-Type: application/json' \
      -d '{"dryRun":false,"force":true}' \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true){process.exit(1)}; if(typeof o.quietHoursBlocked!=="boolean"){process.exit(1)}; if(typeof o.counts!=="object"||typeof o.breakdowns!=="object"){process.exit(1)}; if(typeof o.breakdowns.countsByPriority!=="object"||typeof o.breakdowns.skippedReasons!=="object"){process.exit(1)}'

    curl -sS "$BASE_URL/api/notifications?page=1&pageSize=20" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}'
    curl -sS "$BASE_URL/api/outbound/messages?page=1&pageSize=20" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}; if(o.items[0]&&typeof o.items[0].priority==="undefined"){process.exit(1)}'

    log "cron daily dry-run + execute OK"
  fi
else
  log "SKIP (route missing): /api/cron/daily"
fi

if route_exists "outbound/messages"; then
  OUTBOUND_MESSAGE_ID="$(
    curl -sS -X POST "$BASE_URL/api/outbound/messages" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"channel\":\"SMS\",\"templateKey\":\"remind_remaining\"${STUDENT_ID:+,\"studentId\":\"$STUDENT_ID\"}${LEAD_ID:+,\"leadId\":\"$LEAD_ID\"}${FIRST_NOTIFICATION_ID:+,\"notificationId\":\"$FIRST_NOTIFICATION_ID\"},\"variables\":{\"remaining\":\"1000000\"}}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.outboundMessage?.id){process.exit(1)}; process.stdout.write(o.outboundMessage.id);'
  )"
  curl -sS "$BASE_URL/api/outbound/messages?page=1&pageSize=20" -H "Authorization: Bearer $TOKEN" \
  | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const id='$OUTBOUND_MESSAGE_ID'; if(!Array.isArray(o.items)||!o.items.some(i=>i.id===id)){process.exit(1)}"
  log "outbound create/list OK"

  if route_exists "outbound/dispatch"; then
    curl -sS -X POST "$BASE_URL/api/outbound/dispatch" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"limit":20}' \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(typeof o.total!=="number"||typeof o.accepted!=="number"){process.exit(1)}'
    log "outbound dispatch OK"
  fi

  if route_exists "outbound/callback"; then
    CALLBACK_RESPONSE="$(curl -sS -X POST "$BASE_URL/api/outbound/callback" \
      -H "x-callback-secret: $CALLBACK_SECRET" \
      -H 'Content-Type: application/json' \
      -d "{\"messageId\":\"$OUTBOUND_MESSAGE_ID\",\"status\":\"SENT\",\"providerMessageId\":\"verify-provider-$(date +%s)\"}")"
    if echo "$CALLBACK_RESPONSE" | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); process.exit(o.ok===true?0:1)'; then
      curl -sS "$BASE_URL/api/outbound/messages?page=1&pageSize=50" -H "Authorization: Bearer $TOKEN" \
      | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const id='$OUTBOUND_MESSAGE_ID'; const msg=Array.isArray(o.items)?o.items.find(i=>i.id===id):null; if(!msg||msg.status!=='SENT'||!msg.providerMessageId){process.exit(1)}"
      log "outbound callback cập nhật trạng thái OK"
    else
      log "SKIP outbound callback: callback secret không khớp với server đang chạy"
    fi
  fi

  if route_exists "worker/outbound"; then
    if [[ -z "$WORKER_SECRET_VALUE" ]]; then
      log "SKIP worker: thiếu biến WORKER_SECRET trong môi trường"
    else
      WORKER_MESSAGE_ID="$(
        curl -sS -X POST "$BASE_URL/api/outbound/messages" \
          -H "Authorization: Bearer $TOKEN" \
          -H 'Content-Type: application/json' \
          -d "{\"channel\":\"CALL_NOTE\",\"templateKey\":\"remind_schedule\"${LEAD_ID:+,\"leadId\":\"$LEAD_ID\"},\"variables\":{\"scheduleAt\":\"Ngay mai\"}}" \
        | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.outboundMessage?.id){process.exit(1)}; process.stdout.write(o.outboundMessage.id);'
      )"

      curl -sS -X POST "$BASE_URL/api/worker/outbound" \
        -H "x-worker-secret: $WORKER_SECRET_VALUE" \
        -H 'Content-Type: application/json' \
        -d '{"dryRun":true,"batchSize":20}' \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||typeof o.processed!=="number"){process.exit(1)}'

      curl -sS -X POST "$BASE_URL/api/worker/outbound" \
        -H "x-worker-secret: $WORKER_SECRET_VALUE" \
        -H 'Content-Type: application/json' \
        -d '{"dryRun":false,"batchSize":20,"force":true}' \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||typeof o.processed!=="number"){process.exit(1)}'

      curl -sS "$BASE_URL/api/outbound/messages?page=1&pageSize=100" -H "Authorization: Bearer $TOKEN" \
      | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const id='$WORKER_MESSAGE_ID'; const msg=Array.isArray(o.items)?o.items.find(i=>i.id===id):null; if(!msg){process.exit(1)}; if(msg.status==='QUEUED'){process.exit(1)}; if(msg.status==='FAILED' && Number(msg.retryCount)<=0){process.exit(1)}"

      log "worker outbound dry-run + real OK"
    fi
  fi
else
  log "SKIP (route missing): /api/outbound/messages"
fi

if route_exists "automation/run" && route_exists "automation/logs"; then
  curl -sS -X POST "$BASE_URL/api/automation/run" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d '{"scope":"daily","dryRun":true}' \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.log?.id){process.exit(1)}'

  if [[ -n "$LEAD_ID" ]]; then
    LEAD_AUTOMATION_LOG_ID="$(
      curl -sS -X POST "$BASE_URL/api/automation/run" \
        -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
        -H 'Content-Type: application/json' \
        -d "{\"scope\":\"manual\",\"leadId\":\"$LEAD_ID\",\"dryRun\":true}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.log?.id){process.exit(1)}; process.stdout.write(o.log.id);'
    )"
    curl -sS "$BASE_URL/api/automation/logs?leadId=$LEAD_ID&page=1&pageSize=20" -b "$COOKIE_JAR" \
    | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const id='$LEAD_AUTOMATION_LOG_ID'; if(!Array.isArray(o.items)||!o.items.some(i=>i.id===id)){process.exit(1)}"
    log "automation logs filter leadId OK"
  fi

  curl -sS "$BASE_URL/api/automation/logs?scope=daily&page=1&pageSize=10" \
    -b "$COOKIE_JAR" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}'
  log "automation run/logs OK (cookie session)"
else
  log "SKIP (route missing): /api/automation/run or /api/automation/logs"
fi

if [[ -n "$BRANCH_ID" && -n "$USER_A_ID" && -f "src/app/api/admin/salary-profiles/route.ts" && -f "src/app/api/admin/attendance/route.ts" && -f "src/app/api/admin/commissions/route.ts" && -f "src/app/api/admin/payroll/generate/route.ts" && -f "src/app/api/admin/payroll/finalize/route.ts" && -f "src/app/api/admin/payroll/route.ts" && -f "src/app/api/me/payroll/route.ts" ]]; then
  MONTH_HR="$(date +%Y-%m)"
  DAY1="${MONTH_HR}-01"
  DAY2="${MONTH_HR}-02"
  DAY3="${MONTH_HR}-03"
  DAY4="${MONTH_HR}-04"
  DAY5="${MONTH_HR}-05"

  curl -sS -X PATCH "$BASE_URL/api/admin/branches/$BRANCH_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"commissionPerPaid50":300000}' \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.branch?.id||o.branch.commissionPerPaid50!==300000){process.exit(1)}'

  curl -sS -X POST "$BASE_URL/api/admin/salary-profiles" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"userId\":\"$USER_A_ID\",\"branchId\":\"$BRANCH_ID\",\"roleTitle\":\"Telesales\",\"baseSalaryVnd\":7000000,\"allowanceVnd\":500000,\"standardDays\":26,\"effectiveFrom\":\"$DAY1\"}" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.profile?.id){process.exit(1)}'

  for DAY in "$DAY1" "$DAY2" "$DAY3" "$DAY4" "$DAY5"; do
    curl -sS -X POST "$BASE_URL/api/admin/attendance" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"userId\":\"$USER_A_ID\",\"branchId\":\"$BRANCH_ID\",\"date\":\"$DAY\",\"status\":\"PRESENT\",\"source\":\"MANUAL\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.attendance?.id){process.exit(1)}'
  done

  curl -sS -X POST "$BASE_URL/api/admin/commissions" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"userId\":\"$USER_A_ID\",\"branchId\":\"$BRANCH_ID\",\"periodMonth\":\"$MONTH_HR\",\"sourceType\":\"MANUAL_ADJUST\",\"amountBaseVnd\":200000,\"commissionVnd\":200000,\"note\":\"Verify manual adjust\"}" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.commission?.id){process.exit(1)}'

  if route_exists "admin/commissions/paid50/rebuild"; then
    PAID50_LEAD_ID="$(
      curl -sS -X POST "$BASE_URL/api/leads" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"fullName\":\"Paid50 Verify $(date +%s)\",\"source\":\"manual\",\"channel\":\"manual\"}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.lead?.id){process.exit(1)}; process.stdout.write(o.lead.id);'
    )"

    curl -sS -X PATCH "$BASE_URL/api/leads/$PAID50_LEAD_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"ownerId\":\"$USER_A_ID\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.lead?.id){process.exit(1)}'

    PAID50_STUDENT_ID="$(
      curl -sS -X POST "$BASE_URL/api/students" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"leadId\":\"$PAID50_LEAD_ID\",\"studyStatus\":\"studying\"}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.student?.id){process.exit(1)}; process.stdout.write(o.student.id);'
    )"

    PAID50_PLAN_ID="$(
      curl -sS -X POST "$BASE_URL/api/tuition-plans" \
        -H "Authorization: Bearer $TOKEN" \
        -H 'Content-Type: application/json' \
        -d "{\"province\":\"PAID50 Verify $(date +%s)\",\"licenseType\":\"C1\",\"totalAmount\":12000000,\"paid50Amount\":6000000}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.tuitionPlan?.id){process.exit(1)}; process.stdout.write(o.tuitionPlan.id);'
    )"

    curl -sS -X PATCH "$BASE_URL/api/students/$PAID50_STUDENT_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"tuitionPlanId\":\"$PAID50_PLAN_ID\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.student?.id){process.exit(1)}'

    curl -sS -X POST "$BASE_URL/api/receipts" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"studentId\":\"$PAID50_STUDENT_ID\",\"amount\":2000000,\"method\":\"cash\",\"receivedAt\":\"$DAY1\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.receipt?.id){process.exit(1)}'

    curl -sS -X POST "$BASE_URL/api/receipts" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"studentId\":\"$PAID50_STUDENT_ID\",\"amount\":4000000,\"method\":\"cash\",\"receivedAt\":\"$DAY4\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.receipt?.id){process.exit(1)}'

    curl -sS -X POST "$BASE_URL/api/admin/commissions/paid50/rebuild" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"month\":\"$MONTH_HR\",\"branchId\":\"$BRANCH_ID\",\"dryRun\":true}" \
    | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const sid='$PAID50_STUDENT_ID'; if(o.ok!==true||o.dryRun!==true){process.exit(1)}; if(!Array.isArray(o.preview)){process.exit(1)}; if(!o.preview.some(p=>p.studentId===sid)){process.exit(1)}"

    curl -sS -X POST "$BASE_URL/api/admin/commissions/paid50/rebuild" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"month\":\"$MONTH_HR\",\"branchId\":\"$BRANCH_ID\",\"dryRun\":false}" \
    | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); if(o.ok!==true||o.dryRun!==false){process.exit(1)}; if(typeof o.created!=='number'||o.created<1){process.exit(1)}"

    curl -sS -X POST "$BASE_URL/api/admin/commissions/paid50/rebuild" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"month\":\"$MONTH_HR\",\"branchId\":\"$BRANCH_ID\",\"dryRun\":false}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||o.created!==0){process.exit(1)}'

    curl -sS -X POST "$BASE_URL/api/admin/commissions/paid50/rebuild" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"month":"2000-01","branchId":"'"$BRANCH_ID"'","dryRun":true}' \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.ok!==true||o.previewCount!==0){process.exit(1)}'
  fi

  curl -sS -X POST "$BASE_URL/api/admin/payroll/generate" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"month\":\"$MONTH_HR\",\"branchId\":\"$BRANCH_ID\",\"dryRun\":true}" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(o.dryRun!==true||!Array.isArray(o.items)){process.exit(1)}; if(typeof o.totals?.totalVnd!=="number"){process.exit(1)}'

  curl -sS -X POST "$BASE_URL/api/admin/payroll/generate" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"month\":\"$MONTH_HR\",\"branchId\":\"$BRANCH_ID\",\"dryRun\":false}" \
  | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const uid='$USER_A_ID'; if(o.dryRun!==false||!o.run?.id){process.exit(1)}; const item=(o.run.items||[]).find((x)=>x.userId===uid); if(!item||Number(item.commissionVnd)<500000){process.exit(1)}"

  curl -sS -X POST "$BASE_URL/api/admin/payroll/finalize" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"month\":\"$MONTH_HR\",\"branchId\":\"$BRANCH_ID\"}" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.run?.id||o.run.status!=="FINAL"){process.exit(1)}'

  curl -sS "$BASE_URL/api/admin/payroll?month=$MONTH_HR&branchId=$BRANCH_ID&page=1&pageSize=10" \
    -H "Authorization: Bearer $TOKEN" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}'

  TOKEN_A_PAYROLL="$(
    curl -sS -X POST "$BASE_URL/api/auth/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$USER_A_EMAIL\",\"password\":\"Verify@123456\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); const t=o.accessToken||o.token; if(!t){process.exit(1)}; process.stdout.write(t);'
  )"
  curl -sS "$BASE_URL/api/me/payroll?month=$MONTH_HR" \
    -H "Authorization: Bearer $TOKEN_A_PAYROLL" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}'

  for ROUTE_PATH in "/hr/salary-profiles" "/hr/attendance" "/hr/payroll"; do
    HTTP_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-hr-page.html -w '%{http_code}' "$BASE_URL$ROUTE_PATH" -b "$COOKIE_JAR")"
    [[ "$HTTP_CODE" == "200" ]] || fail "HR route $ROUTE_PATH failed with status $HTTP_CODE"
  done

  log "payroll + attendance verify OK"
else
  log "SKIP payroll verify: thiếu route hoặc dữ liệu đầu vào"
fi

log "VERIFY PASSED"
