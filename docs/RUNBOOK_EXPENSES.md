# RUNBOOK_EXPENSES

## 1) Mục đích
- Vận hành module chi phí gồm chi phí ngày, lương cơ bản theo tháng, insight chi phí.

## 2) Quyền truy cập
- Xem chi phí: `expenses:VIEW`
- Sửa chi phí ngày: `expenses:EDIT`
- Xem lương cơ bản: `salary:VIEW`
- Sửa lương cơ bản: `salary:EDIT`
- Xem insight: `insights:VIEW`
- Ingest insight: `insights:INGEST` (service token route riêng)

## 3) API chính
- `GET /api/expenses/daily?date=YYYY-MM-DD[&branchId=...]`
- `POST /api/expenses/daily`
- `GET /api/expenses/summary?month=YYYY-MM[&branchId=...]`
- `GET /api/expenses/base-salary?month=YYYY-MM[&branchId=...]`
- `POST /api/expenses/base-salary`
- `GET /api/insights/expenses?month=YYYY-MM`
- `POST /api/insights/expenses/ingest` (header `x-service-token`)

## 4) Luồng UI
- Trang tổng hợp tháng: `/expenses/monthly`
  - Chọn tháng -> xem tổng chi phí theo category + tổng lương cơ bản + grand total.
  - Mở drilldown lương cơ bản để chỉnh mức lương từng user trong tháng.
- Trang chi phí ngày: `/expenses/daily`
  - Chọn ngày -> nhập số tiền theo từng category -> lưu.

## 5) Seed dữ liệu
```bash
npx prisma migrate reset --force
npx prisma db seed
```
- Seed sẽ tạo category mặc định theo từng chi nhánh:
  - Mặt bằng
  - Điện nước
  - Wifi
  - Chi phí khác
- Có dữ liệu mẫu 18 ngày chi phí + lương cơ bản tháng hiện tại.

## 6) Smoke test nhanh
1. Health DB:
```bash
curl -i http://127.0.0.1:3000/api/health/db
```
2. Không token gọi summary:
```bash
curl -i "http://127.0.0.1:3000/api/expenses/summary?month=2026-02"
```
- Kỳ vọng: `401` hoặc `403` tùy route guard hiện hành.

## 7) Service token cho ingest
- Route ingest không dùng JWT user:
  - `POST /api/insights/expenses/ingest`
- Header bắt buộc:
  - `x-service-token: <INSIGHTS_SERVICE_TOKEN>`
- Không đưa route này vào public allowlist.

## 8) Lỗi thường gặp
- `AUTH_FORBIDDEN`: thiếu quyền module/action theo RBAC.
- `Thiếu dữ liệu bắt buộc`: body thiếu `dateKey`, `monthKey`, `items` hoặc field con.
- `Không có quyền truy cập chi nhánh`: user không thuộc scope branch hợp lệ.
