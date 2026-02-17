#!/usr/bin/env bash
# verify-full.sh – Smoke-test chính cho thayduy-crm
# Usage: bash scripts/verify-full.sh [BASE_URL]

set -euo pipefail
BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local label=$1 method=$2 url=$3 body="${4:-}"
  local status
  if [ "$method" = "POST" ] && [ -n "$body" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$body" "$url")
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  fi
  if [[ "$status" =~ ^(200|201|302|307)$ ]]; then
    echo "✅ $label → $status"
    ((PASS++))
  else
    echo "❌ $label → $status"
    ((FAIL++))
  fi
}

echo "🔍 Smoke-test thayduy-crm ($BASE)"
echo "─────────────────────────────────"

# Public pages
check "Landing page"       GET  "$BASE/"
check "Student login page"  GET  "$BASE/student/login"
check "Student register"    GET  "$BASE/student/register"

# Public APIs  
check "Tuition plans"      GET  "$BASE/api/public/tuition-plans"
check "Tuition TPHCM"      GET  "$BASE/api/public/tuition-plans?province=TPHCM"
check "Lead POST"           POST "$BASE/api/public/lead" '{"fullName":"Test","phone":"0900000001","province":"TPHCM","licenseType":"B2"}'

# Auth API
check "Student login API"   POST "$BASE/api/student/auth/login" '{"phone":"0900000000","password":"test1234"}'

# E2E Tests (Playwright)
echo ""
echo "── E2E Tests (Playwright) ──"
if command -v npx &> /dev/null && npx playwright test --reporter=list 2>&1; then
  echo "✅ Playwright E2E tests passed"
  ((PASS++))
else
  echo "❌ Playwright E2E tests failed"
  ((FAIL++))
fi

echo ""
echo "─────────────────────────────────"
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo "🎉 All checks passed!" || echo "⚠️  Some checks failed"
exit "$FAIL"
