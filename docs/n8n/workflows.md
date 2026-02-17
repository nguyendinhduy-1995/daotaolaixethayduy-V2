# Danh sách workflow n8n

## Quy ước chung
- Timezone: `Asia/Ho_Chi_Minh`.
- `dateKey`: `YYYY-MM-DD`.
- HTTP node timeout: 30s.
- Retry tiêu chuẩn cho lỗi mạng/5xx: 3 lần (`10s -> 30s -> 90s`, có jitter 10-20%).
- Idempotency key nội bộ n8n: `${workflow}-${dateKey}-${ownerId}-${windowMinutes}-${bucketStart}`.

## WF-01: Pulse Trực Page (Pancake + CRM) -> `/api/ops/pulse`
- Trigger:
  - Cron mỗi 10 phút.
- Input:
  - Pancake API inbound messages theo owner/page.
  - CRM DB/API để tính `dataToday = count LeadEvent(type=HAS_PHONE)` theo `ownerId` trong ngày HCM.
- Nodes chính:
  - `Cron`:
    - Every 10 minutes.
  - `Set DateKey`:
    - Tạo `dateKey` theo HCM.
  - `HTTP Request - Pancake Messages`:
    - Gọi Pancake API, nhận danh sách inbound.
  - `Function - Aggregate messagesToday`:
    - Group theo `ownerId`, tính tổng `messagesToday`.
  - `HTTP Request/DB - CRM dataToday`:
    - Truy vấn số `HAS_PHONE` theo `ownerId + dateKey` (HCM).
  - `Merge`:
    - Join `ownerId`, tạo payload role `PAGE`.
  - `HTTP Request - POST /api/ops/pulse`:
    - Header `x-ops-secret`.
- Output:
  - JSON response `ok/id/status/computedJson` cho từng owner.
- Retry/backoff:
  - Pancake API + CRM ingest dùng retry chuẩn.
- Idempotency:
  - Gửi `windowMinutes=10`; CRM upsert theo bucket 10 phút.

## WF-02: Pulse Telesales 10 phút -> `/api/ops/pulse`
- Trigger:
  - Cron mỗi 10 phút.
- Input:
  - CRM DB/API: `dataToday/calledToday/appointedToday/arrivedToday/signedToday` theo `ownerId`.
- Nodes chính:
  - `Cron`
  - `Set DateKey`
  - `DB Query/HTTP` lấy count từng event type
  - `Function` chuẩn hóa số nguyên >= 0
  - `HTTP Request - POST /api/ops/pulse` với role `TELESALES`
- Output:
  - Snapshot status `OK|WARNING|CRITICAL`, gaps/checklist.
- Idempotency:
  - Cùng bucket sẽ update record cũ.

## WF-03: Marketing daily report -> `/api/marketing/report`
- Trigger:
  - Cron (khuyến nghị mỗi 1h và chốt cuối ngày 23:50 HCM).
- Input:
  - Meta Ads API: spend/messages theo ngày.
  - Mapping branch code (`branchCode`).
- Nodes chính:
  - `Cron`
  - `HTTP Request - Meta API`
  - `Function - Normalize`:
    - `date`, `source=meta`, `spendVnd`, `messages`, `branchCode`.
  - `HTTP Request - POST /api/marketing/report` (`x-marketing-secret`)
- Output:
  - `{ ok: true, item }`.
- Idempotency:
  - Upsert theo `dateKey + branchId + source`.

## WF-04: Daily automation cron -> `/api/cron/daily`
- Trigger:
  - Cron 08:00 hàng ngày (hoặc manual force).
- Nodes chính:
  - `Cron`
  - `Set` body `{ dryRun, force }`
  - `HTTP Request - POST /api/cron/daily` (`x-cron-secret`)
- Output:
  - Counts notifications/outbound + breakdowns + preview.
- Idempotency:
  - Dedupe theo rule notification và dedupe window outbound.

## WF-05: Outbound worker dispatch -> `/api/worker/outbound`
- Trigger:
  - Cron mỗi 1-2 phút.
- Nodes chính:
  - `Cron`
  - `Set` body `{ dryRun, batchSize, concurrency, retryFailedOnly, force }`
  - `HTTP Request - POST /api/worker/outbound` (`x-worker-secret`)
- Output:
  - `processed/sent/failed/skipped/rateLimited`.
- Idempotency:
  - Lease (`leaseId`, `leaseExpiresAt`) chống double dispatch.

## WF-06: Outbound callback realtime -> `/api/outbound/callback`
- Trigger:
  - Webhook từ provider hoặc n8n callback flow.
- Nodes chính:
  - `Webhook`
  - `IF` validate payload tối thiểu (`messageId`, `status`)
  - `HTTP Request - POST /api/outbound/callback` (`x-callback-secret`)
- Output:
  - `{ ok: true }` hoặc error code.
- Idempotency:
  - Update theo `messageId`; callback lặp cập nhật trạng thái mới nhất.

## Mapping retry/backoff gợi ý theo loại lỗi
- `401/403`: không retry, gửi cảnh báo cấu hình secret/token.
- `400/422`: không retry, ghi payload lỗi để sửa mapping/schema.
- `429`: retry exponential + jitter, tôn trọng `Retry-After` nếu có.
- `5xx/network timeout`: retry chuẩn 3 lần, sau đó vào dead-letter.

## Input/Output chuẩn cho WF-01 (khuyến nghị)
- Input record:
  - `{ ownerId, messagesToday, dataToday, dateKey }`
- Payload gửi CRM:
  - `{ role:"PAGE", ownerId, dateKey, windowMinutes:10, metrics:{ messagesToday, dataToday } }`
- Output record:
  - `{ ownerId, pulseStatus, pulseId, computedJson }`
