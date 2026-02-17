# API liên quan KPI / Pulse / Marketing / n8n

## Chuẩn xác thực
- Bearer auth (admin/user): `Authorization: Bearer <ACCESS_TOKEN>`
- Secret auth (server-to-server):
  - `x-ops-secret`
  - `x-marketing-secret`
  - `x-cron-secret`
  - `x-worker-secret`
  - `x-callback-secret`

## 1) KPI

### GET `/api/kpi/daily`
- Auth: Bearer token hoặc cookie access token.
- Query:
  - `date?: YYYY-MM-DD` (mặc định ngày hiện tại theo HCM).
- Body: none.
- Response 200:
```json
{
  "date": "2026-02-15",
  "leads": { "new": 0, "hasPhone": 0 },
  "telesale": {
    "called": 0,
    "appointed": 0,
    "arrived": 0,
    "signed": 0,
    "studying": 0,
    "examined": 0,
    "result": 0,
    "lost": 0
  },
  "finance": {
    "totalThu": 0,
    "totalPhieuThu": 0,
    "totalRemaining": 0,
    "countPaid50": 0
  }
}
```
- Error:
  - `400 BAD_REQUEST` khi `date` sai format.
  - `401 AUTH_MISSING_BEARER | AUTH_INVALID_TOKEN`.

### GET `/api/admin/employee-kpi`
- Auth: Bearer admin.
- Query:
  - `page?: number > 0` (default 1)
  - `pageSize?: number > 0` (default 20, max 100)
  - `role?: PAGE|TELESALES`
  - `active?: true|false`
  - `userId?: string`
- Response 200:
```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

### POST `/api/admin/employee-kpi`
- Auth: Bearer admin.
- Body:
```json
{
  "userId": "cuid",
  "role": "PAGE",
  "effectiveFrom": "2026-02-15",
  "effectiveTo": "2026-02-28",
  "targetsJson": { "dataRatePctTarget": 20 },
  "isActive": true
}
```
- Response 200: `{ "setting": { ... } }`

### PATCH `/api/admin/employee-kpi/:id`
- Auth: Bearer admin.
- Body (partial):
```json
{
  "role": "TELESALES",
  "effectiveFrom": "2026-02-15",
  "effectiveTo": null,
  "targetsJson": { "dataDaily": 4, "appointedDaily": 4 },
  "isActive": true
}
```
- Response 200: `{ "setting": { ... } }`

## 2) Ops Pulse

### POST `/api/ops/pulse`
- Auth: `x-ops-secret`.
- Body:
```json
{
  "role": "PAGE",
  "ownerId": "cuid",
  "adminScope": false,
  "branchId": "cuid",
  "dateKey": "2026-02-15",
  "windowMinutes": 10,
  "metrics": {
    "messagesToday": 120,
    "dataToday": 18
  },
  "targets": {
    "dataRatePctTarget": 20
  }
}
```
- Validation chính:
  - `role` phải `PAGE|TELESALES`.
  - Thiếu `ownerId` chỉ hợp lệ khi `adminScope=true` (trừ TELESALES luôn cần owner).
  - `windowMinutes`: integer `1..120`.
  - `PAGE` bắt buộc `metrics.messagesToday` + `metrics.dataToday`.
  - `TELESALES` bắt buộc `metrics.dataToday/calledToday/appointedToday/arrivedToday/signedToday`.
- Response 200:
```json
{
  "ok": true,
  "id": "cuid",
  "status": "OK",
  "computedJson": {}
}
```

### GET `/api/admin/ops/pulse`
- Auth: Bearer admin.
- Query:
  - `role?: PAGE|TELESALES`
  - `ownerId?: string`
  - `dateKey?: YYYY-MM-DD`
  - `limit?: integer > 0` (max 200)
- Response 200:
```json
{
  "items": [],
  "aggregate": {
    "total": 0,
    "statusCounts": { "OK": 0, "WARNING": 0, "CRITICAL": 0 },
    "latestByRole": {}
  }
}
```

## 3) Marketing

### POST `/api/marketing/report`
- Auth: `x-marketing-secret`.
- Body:
```json
{
  "date": "2026-02-15",
  "source": "meta",
  "spendVnd": 2500000,
  "messages": 42,
  "branchId": "cuid",
  "branchCode": "HCM",
  "meta": { "campaign": "Lead Form" }
}
```
- Response 200: `{ "ok": true, "item": { ... } }`

### POST `/api/marketing/ingest` (deprecated)
- Auth: `x-marketing-secret`.
- Body tương thích cũ:
```json
{
  "source": "meta_ads",
  "grain": "DAY",
  "date": "2026-02-15",
  "spendVnd": 2500000,
  "messages": 42,
  "branchCode": "HCM",
  "meta": {}
}
```
- Response 200: `{ "ok": true, "metric": { ... }, "warning": "Endpoint deprecated..." }`

### GET `/api/marketing/metrics` (deprecated)
- Auth: Bearer user.
- Query:
  - `grain=DAY`
  - `from?: YYYY-MM-DD`
  - `to?: YYYY-MM-DD`
  - `source=meta_ads|meta`
- Response 200:
```json
{
  "items": [],
  "totals": { "spendVnd": 0, "messages": 0, "cplVnd": 0 },
  "warning": "Endpoint deprecated. Use GET /api/admin/marketing/reports"
}
```

### POST `/api/admin/marketing/report`
- Auth: Bearer admin.
- Body: giống `/api/marketing/report`.
- Response 200: `{ "ok": true, "item": { ... } }`

### POST `/api/admin/marketing/ingest` (deprecated)
- Auth: Bearer admin.
- Body: giống `/api/marketing/ingest`.
- Response 200: `{ "ok": true, "metric": { ... }, "warning": "Endpoint deprecated..." }`

### GET `/api/admin/marketing/reports`
- Auth: Bearer admin.
- Query:
  - `from?: YYYY-MM-DD`
  - `to?: YYYY-MM-DD`
  - `branchId?: string`
  - `source?: string`
- Response 200:
```json
{
  "items": [],
  "totals": { "spendVnd": 0, "messages": 0, "cplVnd": 0 },
  "tz": "Asia/Ho_Chi_Minh"
}
```

## 4) n8n vận hành

### GET `/api/admin/n8n/workflows`
- Auth: Bearer admin.
- Response 200:
```json
{
  "ok": true,
  "definitions": [],
  "securityGuidelines": [],
  "ingestEndpoints": [],
  "workflows": []
}
```

### POST `/api/cron/daily`
- Auth: `x-cron-secret`.
- Body:
```json
{ "dryRun": false, "force": false }
```
- Response 200 (rút gọn):
```json
{
  "ok": true,
  "dryRun": false,
  "force": false,
  "quietHoursBlocked": false,
  "counts": {},
  "breakdowns": {},
  "preview": []
}
```

### POST `/api/admin/cron/daily`
- Auth: Bearer admin.
- Body/response: giống `/api/cron/daily`.

### POST `/api/worker/outbound`
- Auth: `x-worker-secret`.
- Body:
```json
{
  "dryRun": false,
  "batchSize": 50,
  "retryFailedOnly": false,
  "force": false,
  "concurrency": 5
}
```
- Response 200:
```json
{
  "ok": true,
  "dryRun": false,
  "processed": 0,
  "sent": 0,
  "failed": 0,
  "skipped": 0,
  "rateLimited": 0,
  "remainingEstimate": 0,
  "breakdownByPriority": { "HIGH": 0, "MEDIUM": 0, "LOW": 0 },
  "breakdownByOwner": [],
  "webhookEnabled": true
}
```

### POST `/api/admin/worker/outbound`
- Auth: Bearer admin.
- Body/response tương đương `/api/worker/outbound`.

### POST `/api/outbound/callback`
- Auth: `x-callback-secret` (so với `N8N_CALLBACK_SECRET`).
- Body:
```json
{
  "messageId": "cuid",
  "status": "SENT",
  "providerMessageId": "provider_123",
  "sentAt": "2026-02-15T10:15:00.000Z",
  "error": "optional"
}
```
- `status` hỗ trợ: `SENT|FAILED|SKIPPED`.
- Response 200: `{ "ok": true }`

## 5) Ví dụ curl nhanh

```bash
BASE_URL=http://localhost:3000
DATE_HCM=2026-02-15

# KPI daily
curl -sS "$BASE_URL/api/kpi/daily?date=$DATE_HCM" \
  -H "Authorization: Bearer $TOKEN"

# Ops pulse PAGE
curl -sS -X POST "$BASE_URL/api/ops/pulse" \
  -H "x-ops-secret: $OPS_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"role":"PAGE","ownerId":"user_cuid","dateKey":"2026-02-15","windowMinutes":10,"metrics":{"messagesToday":120,"dataToday":18}}'

# Marketing report
curl -sS -X POST "$BASE_URL/api/marketing/report" \
  -H "x-marketing-secret: $MARKETING_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-02-15","source":"meta","branchCode":"HCM","spendVnd":2500000,"messages":42}'

# N8n workflows docs API
curl -sS "$BASE_URL/api/admin/n8n/workflows" \
  -H "Authorization: Bearer $TOKEN"
```
