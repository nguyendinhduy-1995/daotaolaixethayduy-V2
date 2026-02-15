# Luồng n8n cho thayduy-crm

## Tổng quan
- n8n là tầng điều phối dữ liệu ngoài (Meta Ads, inbox, scheduler) vào CRM qua API secret-based.
- CRM giữ quyền quyết định nghiệp vụ cuối cùng: validate payload, tính KPI, dedupe/idempotency, lưu log.
- Tất cả thời gian ngày dùng `Asia/Ho_Chi_Minh`; `dateKey` luôn là `YYYY-MM-DD`.

## Định nghĩa KPI chuẩn (bắt buộc)
- PAGE:
  - `dataToday` = count `LeadEvent.type=HAS_PHONE` theo `ownerId` trong ngày.
  - `messagesToday` = tổng inbound messages trong ngày do n8n tổng hợp theo `ownerId + dateKey`.
- TELESALES:
  - `dataToday/calledToday/appointedToday/arrivedToday/signedToday` lấy theo LeadEvent trong ngày theo owner.
- `windowMinutes` mặc định `10` cho ingest Ops Pulse.

## Bảo mật
- Không gọi ingest route nếu thiếu secret header.
- Không lưu secret ở client/browser.
- Header dùng:
  - `x-ops-secret`
  - `x-marketing-secret`
  - `x-cron-secret`
  - `x-worker-secret`
  - `x-callback-secret`

## Workflow W1..W6

### W1 - Ops Pulse Trực Page (10 phút)
- Trigger: Cron mỗi 10 phút.
- Input: inbox messages + owner mapping.
- API: `POST /api/ops/pulse`
- Header: `x-ops-secret: <OPS_SECRET>`
- Payload mẫu:
```json
{
  "role": "PAGE",
  "ownerId": "user_page_01",
  "dateKey": "2026-02-15",
  "windowMinutes": 10,
  "metrics": {
    "messagesToday": 120,
    "dataToday": 18,
    "calledToday": 0,
    "appointedToday": 0,
    "arrivedToday": 0,
    "signedToday": 0
  }
}
```
- Idempotency: unique bucket theo `(role,dateKey,windowMinutes,bucketStart,ownerScopeKey,branchScopeKey)`.
- Retry: 3 lần `10s/30s/60s`.
- Expected: CRM trả `status` `OK/WARNING/CRITICAL` + `computedJson`.

### W2 - Ops Pulse Telesales (10 phút)
- Trigger: Cron mỗi 10 phút.
- Input: LeadEvent theo owner.
- API: `POST /api/ops/pulse`
- Payload mẫu:
```json
{
  "role": "TELESALES",
  "ownerId": "user_tele_01",
  "dateKey": "2026-02-15",
  "windowMinutes": 10,
  "metrics": {
    "messagesToday": 0,
    "dataToday": 8,
    "calledToday": 6,
    "appointedToday": 3,
    "arrivedToday": 1,
    "signedToday": 0
  }
}
```
- Expected: hiển thị trên `/admin/ops`.

### W3 - Marketing report theo ngày
- Trigger: Cron giờ/ngày.
- Input: Meta Ads spend + messages.
- API: `POST /api/marketing/report`
- Header: `x-marketing-secret: <MARKETING_SECRET>`
- Payload mẫu:
```json
{
  "date": "2026-02-15",
  "source": "meta",
  "branchCode": "HCM",
  "spendVnd": 3250000,
  "messages": 58,
  "meta": { "campaign": "Lead Form" }
}
```
- Idempotency: upsert theo `(dateKey, branchId, source)`.

### W4 - Cron daily (notification + queue outbound)
- Trigger: Cron hằng ngày.
- API: `POST /api/cron/daily`
- Header: `x-cron-secret: <CRON_SECRET>`
- Payload:
```json
{ "dryRun": false, "force": false }
```
- Expected: tạo notification + queue outbound + AutomationLog scope `daily`.

### W5 - Worker outbound dispatch
- Trigger: Cron mỗi 1-2 phút.
- API: `POST /api/worker/outbound`
- Header: `x-worker-secret: <WORKER_SECRET>`
- Payload:
```json
{ "dryRun": false, "batchSize": 50, "retryFailedOnly": false, "concurrency": 5 }
```
- Expected: cập nhật trạng thái queue `SENT/FAILED`.

### W6 - Outbound callback
- Trigger: Webhook realtime từ provider/n8n.
- API: `POST /api/outbound/callback`
- Header: `x-callback-secret: <N8N_CALLBACK_SECRET>`
- Payload:
```json
{
  "messageId": "msg_cuid",
  "status": "SENT",
  "providerMessageId": "provider_123",
  "sentAt": "2026-02-15T10:15:00.000Z"
}
```

## API & Secret (cURL mẫu)

### Ops Pulse
```bash
curl -X POST "$BASE_URL/api/ops/pulse" \
  -H "x-ops-secret: $OPS_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"role":"PAGE","ownerId":"user_cuid","dateKey":"2026-02-15","windowMinutes":10,"metrics":{"messagesToday":100,"dataToday":12,"calledToday":0,"appointedToday":0,"arrivedToday":0,"signedToday":0}}'
```

### Marketing report
```bash
curl -X POST "$BASE_URL/api/marketing/report" \
  -H "x-marketing-secret: $MARKETING_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-02-15","source":"meta","branchCode":"HCM","spendVnd":2500000,"messages":42}'
```

### Cron daily
```bash
curl -X POST "$BASE_URL/api/cron/daily" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"force":false}'
```

### Worker outbound
```bash
curl -X POST "$BASE_URL/api/worker/outbound" \
  -H "x-worker-secret: $WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"batchSize":50}'
```

## Runbook tạo workflow trong n8n
1. Tạo node Trigger (Cron/Webhook).
2. Thêm node Set/Function để chuẩn hóa payload theo schema CRM.
3. Thêm node HTTP Request gọi endpoint CRM tương ứng.
4. Thêm IF node kiểm tra `statusCode`:
   - `2xx` -> nhánh success.
   - `4xx/5xx` -> nhánh retry/cảnh báo.
5. Gắn Error Trigger để gửi cảnh báo Slack/Telegram/email.

## Checklist test
- Gọi thử endpoint ingest bằng payload mẫu.
- Xác nhận response `ok=true`.
- Kiểm tra UI CRM:
  - `/admin/ops` với Ops Pulse
  - `/marketing` với Marketing
  - `/automation/logs` với cron/worker

## Troubleshooting
- 401/403: sai hoặc thiếu secret header.
- 400/422: payload sai định dạng (`dateKey`, trường số nguyên, role).
- 500: lỗi service/DB; kiểm tra logs server + thử payload nhỏ.
