# WORKLOG NEXT

## 1) Summary 7 commits gần nhất
- `bc7715b` — `feat: add ops pulse idempotency unique bucket`  
  Thêm idempotency key theo bucket 10 phút cho OpsPulse và chuyển ingest sang upsert chống trùng.
- `4d05d7d` — `fix: resolve marketing branch by code`  
  Sửa resolve chi nhánh marketing theo `Branch.code` thay vì `name`.
- `f26226c` — `perf: push automation log filtering and paging to db`  
  Đưa lọc/paging automation logs xuống query DB, bỏ filter in-memory.
- `43c415e` — `feat: enforce lead event type enum`  
  Đổi `LeadEvent.type` sang enum DB-level và migration map dữ liệu legacy an toàn.
- `b829950` — `refactor: unify marketing endpoints on report pipeline`  
  Hợp nhất pipeline marketing về `MarketingReport`, giữ endpoint cũ dạng adapter/deprecated.
- `6e329f1` — `fix: standardize auth route error codes`  
  Chuẩn hóa auth errors về `AUTH_INVALID_TOKEN` cho route auth liên quan.
- `222dbe9` — `fix: harden admin middleware auth check`  
  Middleware `/admin/*` xác minh session qua `/api/auth/me`, không trust role claim decode-only.

## 2) Behavior/contract changes cần nhớ
- Middleware admin gate:
  - `/admin/*` không còn dựa vào JWT payload decode để quyết định quyền.
  - Bắt buộc verify session server-side qua `/api/auth/me`.
- Marketing unify:
  - Nguồn chính: `MarketingReport` pipeline (`/api/marketing/report`, `/api/admin/marketing/report`, `/api/admin/marketing/reports`).
  - Endpoint cũ `/api/marketing/ingest`, `/api/admin/marketing/ingest`, `/api/marketing/metrics` vẫn dùng được nhưng là deprecated adapter.
- LeadEvent enum:
  - `LeadEvent.type` là enum DB (`LeadEventType`), không còn string tự do.
  - Dữ liệu type cũ ngoài danh sách chuẩn được map về `OTHER`.
- OpsPulse idempotency:
  - Uniqueness theo `(role, dateKey, windowMinutes, bucketStart, ownerScopeKey, branchScopeKey)`.
  - Retry cùng bucket sẽ upsert bản ghi hiện có, không tạo duplicate snapshot.

## 3) Next actions (ưu tiên tiếp theo)
- Gộp hoàn toàn marketing legacy:
  - Lập timeline deprecate và xóa dần `marketing-metrics` service + model `MarketingMetric`.
- Chuẩn hóa auth error mapping toàn frontend:
  - Dựa trên `error.code` thống nhất, giảm phụ thuộc raw message.
- Tăng cường bảo mật middleware:
  - Đánh giá verify JWT signature trực tiếp ở middleware (nếu phù hợp hiệu năng/edge runtime).
- Tối ưu observability:
  - Thêm metrics/query dashboard cho automation logs và ops pulse (latency, volume, error rate).
- Hoàn thiện runbook migration:
  - Bổ sung checklist rollback/an toàn dữ liệu cho các migration enum/idempotency mới.

