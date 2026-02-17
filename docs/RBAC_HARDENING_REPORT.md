# RBAC Hardening Report

## 1) Thay đổi chính
- Bật cơ chế **deny-by-default** cho toàn bộ `/api/**` tại `middleware.ts`.
- Chuẩn hóa allowlist rõ ràng tại `src/lib/route-permissions-map.ts` gồm:
  - `PUBLIC_API_ROUTES`
  - `SECRET_AUTH_ROUTES`
- Chuẩn hóa audit coverage tại `scripts/audit-route-permissions.ts`:
  - Mọi `method + route` trong `src/app/api/**/route.ts` phải thuộc allowlist hoặc có mapping quyền.
  - Mọi route đã mapping bắt buộc gọi helper enforce: `requireMappedRoutePermissionAuth` hoặc `requirePermissionRouteAuth`.
- Tăng enforcement permission ở route-level:
  - Route không có mapping (và không nằm allowlist) sẽ trả `403 AUTH_FORBIDDEN`.
- Tăng enforcement data-scope ở service/query layer bằng `src/lib/scope.ts`.

## 2) Deny-by-default cho API
- File: `middleware.ts`
- Quy tắc:
  - `OPTIONS` luôn cho qua.
  - Nếu route thuộc allowlist public/secret thì cho qua middleware RBAC (để route tự xử lý auth phù hợp).
  - Nếu route không có mapping trong `resolveRoutePermission(path, method)` => trả `403 AUTH_FORBIDDEN`.

## 3) Danh sách allowlist

### PUBLIC_API_ROUTES
- `GET /api/health/db`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/student/auth/login`
- `POST /api/student/auth/register`
- `POST /api/student/auth/logout`
- `GET /api/student/me`
- `GET /api/student/content`
- `/api/templates/**`

### SECRET_AUTH_ROUTES
- `POST /api/outbound/callback`
- `POST /api/marketing/ingest`
- `POST /api/marketing/report`
- `POST /api/ops/pulse`
- `POST /api/cron/daily`
- `POST /api/worker/outbound`

## 4) Audit coverage + enforce
- File: `scripts/audit-route-permissions.ts`
- Kết quả mới nhất:
  - `Total route methods: 107`
  - `Mapped rules: 95`
  - `Allowlist public: 11`
  - `Allowlist secret: 6`
  - Trạng thái: `PASS`

## 5) Các route thiếu enforce đã sửa
Đợt hardening này đã chuyển nhiều route từ `requireRouteAuth`/`requireAuth` sang enforce mapped-permission:
- Nhóm Admin: attendance, branches, commissions, cron, employee-kpi, marketing report/ingest/reports, n8n/workflows, ops/pulse, salary-profiles, scheduler/health, student-content.
- Nhóm nghiệp vụ chính: courses, kpi/daily, marketing/metrics, me/payroll, notifications, outbound/dispatch, outbound/messages, receipts/summary, scheduler/health, students, tuition-plans.
- Các file cụ thể được liệt kê đầy đủ trong `PATCH_NOTES.md`.

## 6) Quyết định nghiệp vụ về scope
- File nguồn: `src/lib/scope.ts`
- Quy tắc scope:
  - `ADMIN` => `SYSTEM` (toàn hệ thống).
  - `MANAGER` có `branchId` => `BRANCH`.
  - Role còn lại => `OWNER`.
- Áp dụng scope vào where-query:
  - Leads: owner/branch theo user.
  - Students: theo lead.owner/branch.
  - Receipts: theo student -> lead.owner/branch.
  - Schedule: theo course -> students -> lead.owner/branch.
- Mở rộng thực thi ở route/service chính:
  - `leads`, `students`, `receipts`, `schedule`, `outbound/messages`, `admin/payroll`.

## 7) Kiểm thử
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run audit:permissions`: PASS
- `npx playwright test tests/rbac-permissions.spec.ts`: FAIL trong môi trường hiện tại
  - Lỗi chính: không khởi động được webServer ổn định (`listen EPERM 0.0.0.0:3000` / treo pha startup).
