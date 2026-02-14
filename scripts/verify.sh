#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="http://localhost:3000"
STARTED_SERVER=0
DEV_PID=""
COOKIE_JAR="/tmp/thayduy-crm-verify-cookie.txt"

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
npm run lint
npm run build

if curl -sS "$BASE_URL/api/health/db" | grep -q '"ok":true'; then
  log "Dev server already running on :3000 (reuse)"
else
  log "Starting dev server in background"
  npm run dev > /tmp/thayduy-crm-verify-dev.log 2>&1 &
  DEV_PID=$!
  STARTED_SERVER=1
fi

log "Waiting for health endpoint"
wait_for_health || fail "Health check failed at $BASE_URL/api/health/db"

TOKEN="$(get_token)" || fail "Login failed; cannot obtain token"
log "Login OK"

DASHBOARD_HTTP_CODE="$(curl -sS -o /tmp/thayduy-crm-verify-dashboard.html -w '%{http_code}' "$BASE_URL/dashboard" -b "$COOKIE_JAR")"
[[ "$DASHBOARD_HTTP_CODE" == "200" ]] || fail "Dashboard route failed with status $DASHBOARD_HTTP_CODE"
log "dashboard HTML route OK"

if route_exists "auth/me"; then
  curl -sS "$BASE_URL/api/auth/me" -b "$COOKIE_JAR" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.user?.id){process.exit(1)}'
  log "auth/me qua cookie OK"
else
  log "SKIP (route missing): /api/auth/me"
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

USER_ID=""
USER_A_ID=""
USER_B_ID=""
USER_A_EMAIL=""
USER_B_EMAIL=""
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

LEAD_ID=""
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
    TOKEN_A="$(
      curl -sS -X POST "$BASE_URL/api/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$USER_A_EMAIL\",\"password\":\"Verify@123456\"}" \
      | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); const t=o.accessToken||o.token; if(!t){process.exit(1)}; process.stdout.write(t);'
    )"
    curl -sS "$BASE_URL/api/leads?page=1&pageSize=100" -H "Authorization: Bearer $TOKEN_A" \
    | node -e "const fs=require('fs'); const o=JSON.parse(fs.readFileSync(0,'utf8')); const aid='$USER_A_ID'; if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}; if(o.items.some(i=>i.ownerId!==aid)){process.exit(1)}"
    curl -sS "$BASE_URL/api/leads/$LEAD_ID/events?page=1&pageSize=20&sort=createdAt&order=desc" -H "Authorization: Bearer $TOKEN" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)){process.exit(1)}; if(!o.items.some(i=>i.type==="OWNER_CHANGED")){process.exit(1)}'
    log "leads assign/auto-assign + telesales scope + OWNER_CHANGED event OK"
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
if route_exists "students" && [[ -n "$LEAD_ID" ]]; then
  STUDENT_ID="$(
    curl -sS -X POST "$BASE_URL/api/students" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"leadId\":\"$LEAD_ID\"${COURSE_ID:+,\"courseId\":\"$COURSE_ID\"},\"studyStatus\":\"studying\"}" \
    | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.student?.id){process.exit(1)}; process.stdout.write(o.student.id);'
  )"
  log "students create OK"
elif route_exists "students"; then
  log "SKIP (students create): missing lead id"
else
  log "SKIP (route missing): /api/students"
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
  log "receipts create/list/summary/get OK"
elif route_exists "receipts"; then
  log "SKIP (receipts): missing student id"
else
  log "SKIP (route missing): /api/receipts"
fi

if route_exists "automation/run" && route_exists "automation/logs"; then
  curl -sS -X POST "$BASE_URL/api/automation/run" \
    -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d '{"scope":"daily","dryRun":true}' \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!o.log?.id){process.exit(1)}'
  curl -sS "$BASE_URL/api/automation/logs?scope=daily&page=1&pageSize=10" \
    -b "$COOKIE_JAR" \
  | node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(0,"utf8")); if(!Array.isArray(o.items)||o.items.length===0){process.exit(1)}'
  log "automation run/logs OK (cookie session)"
else
  log "SKIP (route missing): /api/automation/run or /api/automation/logs"
fi

log "VERIFY PASSED"
