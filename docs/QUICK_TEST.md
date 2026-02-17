# QUICK_TEST

## 1) Đăng nhập
- Mở `http://127.0.0.1:3000/login`
- Đăng nhập bằng:
  - `Nguyendinhduy / Nguyendinhduy@95`

## 2) Leads
- Vào `/leads`
- Kiểm tra có dữ liệu danh sách khách hàng (>=20).
- Mở 1 khách hàng kiểm tra timeline event có chuỗi NEW -> HAS_PHONE -> CALLED...

## 3) KPI ngày
- Vào `/kpi/daily`
- Kiểm tra có số liệu tổng hợp theo owner/ngày.

## 4) Students
- Vào `/students`
- Kiểm tra có học viên liên kết từ lead + course + tuition plan.

## 5) Schedule
- Vào `/schedule`
- Kiểm tra có lịch học nhiều trạng thái `PLANNED/DONE/CANCELLED`.
- Mở một lịch `DONE` kiểm tra có session/attendance.

## 6) Receipts
- Vào `/receipts`
- Kiểm tra mỗi học viên có thể có nhiều phiếu thu.

## 7) API Hub
- Vào `/api-hub`
- Kiểm tra catalog API hiển thị và search hoạt động.

## 8) Smoke API nhanh
```bash
curl -i http://127.0.0.1:3000/api/health/db
curl -i http://127.0.0.1:3000/api/auth/me
```
- `/api/health/db` kỳ vọng `200`.
- `/api/auth/me` khi chưa đăng nhập kỳ vọng `401`.
