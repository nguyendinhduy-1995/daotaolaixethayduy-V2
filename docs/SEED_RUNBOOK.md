# SEED_RUNBOOK

## Mục tiêu
- Tạo dữ liệu mẫu deterministic cho toàn bộ luồng chính của CRM để test nghiệp vụ.
- Mỗi lần chạy seed cho ra bộ dữ liệu giống nhau.

## Điều kiện
- Đã cấu hình `DATABASE_URL` trỏ đúng Postgres local.
- Đã cài dependencies: `npm install`.

## Chạy từ đầu (khuyến nghị dev)
1. Khởi động DB:
```bash
docker compose up -d postgres
```
2. Reset DB và migrate:
```bash
npx prisma migrate reset --force
```
3. Seed dữ liệu:
```bash
npx prisma db seed
```

## Chạy seed nhanh khi đã có schema
```bash
npx prisma db seed
```

## Tài khoản mặc định sau seed
- Tài khoản quản trị chính:
  - Tài khoản: `Nguyendinhduy`
  - Mật khẩu: `Nguyendinhduy@95`
  - Role: `admin`
- Tài khoản fallback:
  - Email: `admin@thayduy.local`
  - Mật khẩu: `Admin@123456`

## Dữ liệu seed chính
- Users: 8
- Leads: 24 + LeadEvents + LeadMessages
- Students: 20
- Courses: 5
- CourseScheduleItem: 35
- TuitionPlan: 5
- Receipts: >=30
- Payroll/Commission: >=20 bản ghi
- AutomationLog/OutboundMessage: >=20 bản ghi

## Ghi chú timezone
- Seed dùng mốc thời gian business theo `Asia/Ho_Chi_Minh` (UTC+7), convert sang `Date` UTC để lưu DB.
