# CHANGELOG_REPO_AUDIT_FIXES

## 1) Tổng quan audit
- Đã rà các lớp chính: DB/migrations, auth guard, RBAC route mapping, seed, scripts local run.
- Mục tiêu: ổn định local run + tránh regression khi reset DB và verify gate.

## 2) Lỗi/rủi ro đã xử lý
- Migration reset fail do thứ tự enum RBAC và migration chi phí.
- Route permission deny-by-default thiếu mapping cho module chi phí mới.
- Thiếu dữ liệu seed cho module chi phí khiến UI/API khó test end-to-end.
- Runbook chưa phản ánh script `dev:stable` cho trường hợp Turbopack kẹt cache.

## 3) Các fix đã thực hiện
- Prisma:
  - Vá migration `20260216073632_expenses_module` để tránh fail khi enum chưa tồn tại.
  - Thêm migration forward-only `20260216210000_permission_enum_expenses_finalize` để bảo đảm enum values tồn tại sau RBAC.
- RBAC:
  - Thêm module/action permissions cho `expenses/salary/insights` + `EDIT/INGEST`.
  - Map đầy đủ route chi phí/insight trong `src/lib/route-permissions-map.ts`.
- Service/API:
  - Thêm service layer và route API module chi phí theo scope branch.
- Seed:
  - Tạo dữ liệu mẫu category/chi phí ngày/lương cơ bản/insights.
- Docs:
  - Bổ sung changelog/runbook module chi phí.
  - Cập nhật permission matrix + integration spec + review packet.

## 4) Kết quả kiểm thử
- PASS:
  - `npm run lint`
  - `npm run build`
  - `npm run verify`
  - `npx prisma migrate reset --force`
  - `npx prisma migrate deploy`
  - `npx prisma generate`
  - `npx prisma db seed`
- Lưu ý môi trường sandbox:
  - Một số smoke runtime kiểu start server nền có thể gặp `EPERM` bind port trong sandbox hiện tại; không phản ánh lỗi logic ứng dụng.

## 5) TODO duy trì
- Cân nhắc tách `type: module` hoặc chuẩn hóa scripts TS để tránh cảnh báo `MODULE_TYPELESS_PACKAGE_JSON`.
- Bổ sung test API chi phí ở mức integration cho case scope branch/owner.
- Nếu CI cần e2e đầy đủ, chạy trên runner cho phép bind port/browser process đầy đủ quyền.
