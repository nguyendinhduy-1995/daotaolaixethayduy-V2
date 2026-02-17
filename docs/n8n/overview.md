# Tổng quan n8n - thayduy-crm

## 1) Mục tiêu
- Chuẩn hóa luồng tích hợp n8n với CRM cho các nhóm: KPI, Ops Pulse, Marketing, Outbound.
- Đảm bảo mọi ingest có: xác thực secret/token, kiểm tra schema, retry/backoff, idempotency.

## 2) Trạng thái hiện tại trong repo
- Đã có admin page `GET /admin/n8n` (admin-only) và menu admin đã có link "Luồng n8n".
- Đã có API tổng hợp tài liệu workflow: `GET /api/admin/n8n/workflows`.
- Đã có đầy đủ ingest endpoints chính:
  - Ops Pulse: `POST /api/ops/pulse`
  - Marketing report: `POST /api/marketing/report`
  - Cron daily: `POST /api/cron/daily`
  - Worker outbound: `POST /api/worker/outbound`
  - Callback outbound: `POST /api/outbound/callback`

## 3) Định nghĩa KPI bắt buộc
- Múi giờ chuẩn: `Asia/Ho_Chi_Minh`.
- `dateKey`: format `YYYY-MM-DD` theo giờ HCM.
- Định nghĩa bắt buộc cho Trực Page:
  - `dataToday = count(LeadEvent.type = HAS_PHONE)` theo `ownerId` trong ngày `dateKey` (HCM).
  - `messagesToday = tổng inbound messages` theo `ownerId + dateKey` lấy từ Pancake API (không lấy từ CRM).

## 4) Nguồn dữ liệu theo domain
- Pancake API: lấy inbound conversation/message để tính `messagesToday`.
- CRM DB/API: lấy `LeadEvent` để tính `dataToday` và các chỉ số telesales.
- Meta Ads API: lấy `spendVnd`, `messages` để upsert báo cáo marketing.
- Provider callback/n8n webhook: đồng bộ trạng thái gửi outbound về CRM.

## 5) Chống trùng và độ tin cậy
- Ops Pulse idempotent theo unique key DB:
  - `(role, dateKey, windowMinutes, bucketStart, ownerScopeKey, branchScopeKey)`.
- Marketing report idempotent theo unique key:
  - `(dateKey, branchId, source)` (nhánh null xử lý bằng transaction find-first/update/create).
- Retry mặc định đề xuất:
  - Lỗi mạng/5xx: exponential backoff + jitter.
  - Lỗi 4xx validation/auth: không retry, chuyển cảnh báo vận hành.

## 6) Tài liệu chi tiết
- Danh sách workflow + cấu hình node: `docs/n8n/workflows.md`
- Contract API + curl mẫu: `docs/n8n/api.md`
