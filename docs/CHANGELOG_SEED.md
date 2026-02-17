# CHANGELOG_SEED

## Summary
- Bổ sung seed tổng cho toàn bộ nghiệp vụ chính trong `prisma/seed.ts`.
- Chuẩn hóa lệnh seed để chạy trực tiếp bằng `npx prisma db seed`.
- Bổ sung đăng nhập bằng `email OR username(name)` để dùng tài khoản `Nguyendinhduy`.

## Files changed
- `prisma/seed.ts` (new)
  - Seed deterministic (seed number cố định) với dữ liệu mẫu đa module.
  - Xóa dữ liệu cũ theo thứ tự FK an toàn trước khi tạo mới.
  - Tạo users/leads/events/messages/students/courses/schedules/receipts/payroll/commission/automation/outbound.
- `prisma.config.ts`
  - Cập nhật `migrations.seed` -> `ts-node --transpile-only prisma/seed.ts`.
- `package.json`
  - `db:seed` dùng `prisma db seed`.
  - Thêm `prisma.seed`.
- `src/app/api/auth/login/route.ts`
  - Chấp nhận đăng nhập bằng `account` (email hoặc name), giữ tương thích payload cũ.
  - Chuẩn hóa message tiếng Việt.
- `src/app/login/page.tsx`
  - Đổi label thành `Tài khoản`.
  - Gửi payload `account` (kèm `email` để tương thích ngược).
  - Prefill tài khoản `Nguyendinhduy`.
- `SEED_RUNBOOK.md` (new)
- `QUICK_TEST.md` (new)

## Credentials sau seed
- `Nguyendinhduy / Nguyendinhduy@95`
- `admin@thayduy.local / Admin@123456`

## Verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma db seed`: PASS
