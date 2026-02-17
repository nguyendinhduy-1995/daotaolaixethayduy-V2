# API_INTEGRATION_SPEC

## 1) Base URL
- Local: `http://localhost:3000`
- Staging (placeholder): `https://staging.example.com`
- Production (placeholder): `https://api.example.com`

## 2) Auth flow chuẩn

### 2.1 Đăng nhập
- Endpoint: `POST /api/auth/login`
- Body:
```json
{
  "email": "admin@example.com",
  "password": "REDACTED"
}
```
- Response thành công (rút gọn):
```json
{
  "token": "REDACTED",
  "accessToken": "REDACTED",
  "tokenType": "Bearer",
  "user": {
    "id": "...",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### 2.2 Gọi API nghiệp vụ
- Header bắt buộc:
- `Authorization: Bearer <accessToken>`

### 2.3 Làm mới token
- Endpoint: `POST /api/auth/refresh`
- Nguồn refresh token:
- Cookie `refreshToken` (ưu tiên), hoặc
- Body `{ "refreshToken": "..." }`, hoặc
- `Authorization: Bearer <refreshToken>`
- Response trả lại `accessToken` mới.

### 2.4 Đăng xuất
- Endpoint: `POST /api/auth/logout`
- Kết quả: xoá auth cookie server-side.

## 3) Quy ước lỗi JSON
- HTTP status nằm ở status code của response.
- Body lỗi chuẩn:
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Thiếu dữ liệu bắt buộc"
  }
}
```
- Trường:
- `error.code`: mã lỗi máy đọc.
- `error.message`: thông điệp tiếng Việt cho người dùng.

## 3.1) Lỗi thiếu quyền (RBAC)
- Khi token hợp lệ nhưng thiếu quyền module/action:
- HTTP: `403`
- Body:
```json
{
  "ok": false,
  "error": {
    "code": "AUTH_FORBIDDEN",
    "message": "Bạn không có quyền thực hiện"
  }
}
```
- Các API nhạy cảm đã enforce theo module/action gồm tối thiểu:
- người dùng (`/api/users*`, `/api/admin/users*`)
- lịch học (`/api/schedule*`)
- phiếu thu (`/api/receipts*`)
- lead assign/auto-assign (`/api/leads/assign`, `/api/leads/auto-assign`)
- payroll (`/api/admin/payroll*`)
- automation run/logs (`/api/automation/run`, `/api/automation/logs`)

## 3.2) Quy ước quyền module/action khi tích hợp
- Quyền được kiểm tra theo cặp:
- `module`: ví dụ `leads`, `receipts`, `schedule`, `admin_users`, `automation_run`.
- `action`: `VIEW | CREATE | UPDATE | DELETE | EXPORT | ASSIGN | RUN`.
- Nếu đối tác cần kiểm thử quyền, dùng endpoint:
- `GET /api/auth/me` để lấy `user.permissions` dạng `module:action`.

## 4) Idempotency guideline (chuẩn tích hợp ngoài)

### 4.1 Header đề xuất
- `Idempotency-Key: <uuid-v4>`
- Scope key khuyến nghị:
- theo `method + path + body-hash + tenant`.
- Gợi ý format thay thế:
  - `${runId}:${route}:${entityId}` nếu hệ thống upstream đã có runId ổn định.

### 4.2 Endpoint cần áp dụng
- `POST /api/receipts` (tạo phiếu thu)
- `POST /api/outbound/dispatch` (đẩy dispatch gửi tin)
- `POST /api/outbound/jobs` (tạo outbound từ action UI/AI)
- `POST /api/schedule` (tạo lịch học thủ công)
- `POST /api/ai/suggestions/ingest` (ingest gợi ý KPI từ n8n)

### 4.3 Trạng thái hiện tại trong repo
- Repo đã enforce cho các POST tạo quan trọng:
  - `POST /api/receipts`
  - `POST /api/schedule`
  - `POST /api/outbound/dispatch`
  - `POST /api/outbound/jobs`
  - `POST /api/ai/suggestions/ingest`
  - `POST /api/insights/expenses/ingest`
- TTL lưu idempotency: 72 giờ.

### 4.4 Hành vi mục tiêu khi triển khai đầy đủ
- Cùng `Idempotency-Key` + cùng payload -> trả lại kết quả cũ.
- Cùng key nhưng payload khác -> trả `409 CONFLICT`.

### 4.5 Retry strategy khuyến nghị
- Số lần retry tối đa cho caller ngoài: `3` lần.
- Backoff khuyến nghị:
  - lần 1: `2s`
  - lần 2: `5s`
  - lần 3: `15s`
- Chỉ retry với lỗi mạng/timeout/5xx; không retry với `4xx` validation/permission.

## 5) Webhook/Callback contract

### 5.1 Outbound callback
- Endpoint: `POST /api/outbound/callback`
- Auth callback:
- Header bắt buộc: `x-callback-secret: <N8N_CALLBACK_SECRET>`
- Payload tối thiểu:
```json
{
  "messageId": "REDACTED_MESSAGE_ID",
  "status": "SENT"
}
```
- Payload đầy đủ (khuyến nghị):
```json
{
  "messageId": "REDACTED_MESSAGE_ID",
  "status": "FAILED",
  "providerMessageId": "provider-123",
  "error": "Lỗi nhà cung cấp",
  "sentAt": "2026-02-16T10:00:00.000Z"
}
```
- `status` hợp lệ: `SENT | FAILED | SKIPPED`.

### 5.2 Retry callback
- Bên gửi callback nên retry khi nhận non-2xx hoặc timeout.
- Exponential backoff khuyến nghị: `2m -> 10m -> 60m`.
- Server hiện xử lý FAILED bằng cách tăng `retryCount` và set `nextAttemptAt` theo backoff nội bộ.

### 5.3 Signature placeholder
- Header dự phòng chuẩn hoá: `x-signature` (HMAC SHA256 payload).
- Hiện route đang dùng `x-callback-secret`, chưa verify `x-signature`.

## 6) Ví dụ cURL nhanh

### Login
```bash
curl -sS -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"REDACTED"}'
```

### Refresh
```bash
curl -sS -X POST http://localhost:3000/api/auth/refresh \
  -H 'Authorization: Bearer REDACTED_REFRESH_TOKEN'
```

### API nghiệp vụ với Bearer
```bash
curl -sS 'http://localhost:3000/api/leads?page=1&pageSize=20' \
  -H 'Authorization: Bearer REDACTED_ACCESS_TOKEN'
```

## 7) Module chi phí vận hành

### 7.1 Daily expenses
- `GET /api/expenses/daily?date=YYYY-MM-DD[&branchId=...]`
- `POST /api/expenses/daily`
```json
{
  "dateKey": "2026-02-16",
  "branchId": "REDACTED_BRANCH_ID",
  "items": [
    { "categoryId": "REDACTED_CATEGORY_ID", "amountVnd": 1500000, "note": "Mặt bằng" }
  ]
}
```

### 7.2 Monthly summary
- `GET /api/expenses/summary?month=YYYY-MM[&branchId=...]`
- Trả:
  - `totalsByCategory`
  - `expensesTotalVnd`
  - `baseSalaryTotalVnd`
  - `grandTotalVnd`

### 7.3 Base salary drilldown
- `GET /api/expenses/base-salary?month=YYYY-MM[&branchId=...]`
- `POST /api/expenses/base-salary`
```json
{
  "monthKey": "2026-02",
  "items": [
    { "userId": "REDACTED_USER_ID", "baseSalaryVnd": 12000000, "note": "Mức tháng 02" }
  ]
}
```

### 7.4 Insights read
- `GET /api/insights/expenses?month=YYYY-MM[&date=YYYY-MM-DD][&branchId=...]`

### 7.5 Insights ingest (service-token)
- `POST /api/insights/expenses/ingest`
- Header bắt buộc:
  - `x-service-token: <SERVICE_TOKEN>`
  - `Idempotency-Key: <uuid-v4>`
- Payload mẫu:
```json
{
  "branchCode": "Q1",
  "dateKey": "2026-02-16",
  "monthKey": "2026-02",
  "source": "n8n",
  "runId": "n8n-expense-2026-02-16-001",
  "summary": "Chi phí tăng 8% do điện nước",
  "payloadJson": { "deltaPct": 8, "source": "n8n" },
  "source": "n8n"
}
```

## 8) Trợ lý công việc (n8n-driven)

### 8.1 KPI Targets
- `GET /api/kpi/targets?branchId=...&role=...&dayOfWeek=...`
- `POST /api/kpi/targets`
```json
{
  "branchId": "REDACTED_BRANCH_ID",
  "items": [
    {
      "role": "telesales",
      "metricKey": "appointed_rate_pct",
      "targetValue": 35,
      "dayOfWeek": 1,
      "isActive": true
    }
  ]
}
```

### 8.2 Goals ngày/tháng
- `GET /api/goals?periodType=DAILY&dateKey=2026-02-16&branchId=...`
- `GET /api/goals?periodType=MONTHLY&monthKey=2026-02&branchId=...`
- `POST /api/goals`
```json
{
  "periodType": "MONTHLY",
  "branchId": "REDACTED_BRANCH_ID",
  "monthKey": "2026-02",
  "revenueTarget": 1200000000,
  "dossierTarget": 380,
  "costTarget": 280000000,
  "note": "Mục tiêu tháng"
}
```

### 8.3 AI Suggestions read + create + feedback
- `GET /api/ai/suggestions?date=2026-02-16`
- `POST /api/ai/suggestions`
- `POST /api/ai/suggestions/{id}/feedback`
```json
{
  "dateKey": "2026-02-16",
  "role": "telesales",
  "branchId": "REDACTED_BRANCH_ID",
  "title": "Ưu tiên gọi lại nhóm khách hẹn",
  "content": "Sắp xếp gọi lại nhóm khách đang chờ xác nhận lịch hẹn",
  "scoreColor": "YELLOW"
}
```
```json
{
  "rating": 5,
  "applied": true,
  "note": "Gợi ý phù hợp"
}
```

### 8.4 AI Suggestions ingest (service-token)
- `POST /api/ai/suggestions/ingest`
- Header bắt buộc:
  - `x-service-token: <SERVICE_TOKEN>`
  - `Idempotency-Key: <uuid-v4>`
- Payload mẫu:
```json
{
  "source": "n8n",
  "runId": "kpi-coach-2026-02-16-1010",
  "suggestions": [
    {
      "dateKey": "2026-02-16",
      "role": "telesales",
      "branchId": "REDACTED_BRANCH_ID",
      "ownerId": "REDACTED_USER_ID",
      "scoreColor": "RED",
      "title": "Tỷ lệ hẹn từ data đang thấp",
      "content": "- Gọi lại nhóm data có số\\n- Ưu tiên nhóm lịch hẹn hôm qua",
      "actionsJson": [
        {
          "type": "outbound_call",
          "label": "Tạo danh sách gọi nhắc",
          "channel": "CALL_NOTE",
          "templateKey": "remind_schedule",
          "leadId": "REDACTED_LEAD_ID"
        }
      ],
      "metricsJson": {
        "gap": 12,
        "funnel": {
          "hasPhone": 48,
          "called": 29
        }
      }
    }
  ]
}
```

### 8.5 Outbound job từ action AI
- `POST /api/outbound/jobs`
- Header: `Authorization: Bearer ...` + `Idempotency-Key`
- Payload:
```json
{
  "channel": "CALL_NOTE",
  "templateKey": "remind_schedule",
  "leadId": "REDACTED_LEAD_ID",
  "variables": {
    "scheduleAt": "2026-02-17 08:00"
  },
  "note": "Tạo từ Trợ lý công việc"
}
```

### 8.6 Tasks automation (map Notification)
- `GET /api/tasks`
- `POST /api/tasks`
```json
{
  "title": "Gọi lại khách hẹn",
  "message": "Ưu tiên xử lý trước 16h",
  "scope": "FOLLOWUP",
  "priority": "HIGH",
  "ownerId": "REDACTED_USER_ID"
}
```

### 8.7 Outbound API map (POST/GET)
- `GET /api/outbound/messages`
- `POST /api/outbound/messages`
- `POST /api/outbound/jobs`
- `POST /api/outbound/dispatch`

### 8.8 Automation logs read + create
- `GET /api/automation/logs`
- `POST /api/automation/logs`
```json
{
  "channel": "TASK",
  "milestone": "n8n.manual",
  "status": "sent",
  "branchId": "REDACTED_BRANCH_ID",
  "payload": { "note": "ghi log từ tích hợp ngoài" }
}
```

### Callback outbound
```bash
curl -sS -X POST http://localhost:3000/api/outbound/callback \
  -H 'Content-Type: application/json' \
  -H 'x-callback-secret: REDACTED' \
  -d '{"messageId":"REDACTED_MESSAGE_ID","status":"SENT"}'
```
