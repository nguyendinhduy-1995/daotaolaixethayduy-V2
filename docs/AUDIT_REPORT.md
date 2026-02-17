# AUDIT_REPORT

## Phạm vi audit
- Quét cấu trúc module chính: `src/app`, `src/app/api`, `src/lib`, `prisma/schema.prisma`, `prisma/migrations`, `scripts`, `docker-compose.yml`, `.env*`.
- Kiểm tra điểm dễ lỗi runtime local macOS: cổng dev/app, cổng Postgres/Redis, Prisma migration chain, auth/permission deny-by-default.

## Tóm tắt cấu trúc hệ thống
- UI App Router: `src/app/(app)/**`, student portal: `src/app/student/**`, login: `src/app/login/page.tsx`.
- API routes: `src/app/api/**/route.ts`.
- RBAC/Auth:
  - Middleware deny-by-default: `middleware.ts`.
  - Route permission map + allowlist: `src/lib/route-permissions-map.ts`.
  - Route auth helper: `src/lib/route-auth.ts`.
  - Scope helper: `src/lib/scope.ts`.
- Database:
  - Prisma schema: `prisma/schema.prisma`.
  - Migrations: `prisma/migrations/*`.

## Findings

### P0
0. Chuẩn hóa production migration cho OutboundMessage (mới)
- Vấn đề:
  - Lịch sử migration có giai đoạn `outbound_worker_lease` chứa logic “tự tạo bảng tối thiểu” để né lỗi `P3006/P1014`.
  - Cách này giúp local chạy, nhưng rủi ro production vì migration lease bị mang thêm trách nhiệm schema nền (khó audit/rollback).
- File liên quan:
  - `prisma/migrations/20260214210000_outbound_worker_lease/migration.sql`
  - `prisma/migrations/20260216180000_outbound_message_alignment/migration.sql` (mới)
- Quyết định:
  - Giữ nguyên migration cũ (giả định có thể đã deploy ở môi trường dùng chung).
  - Thêm migration forward-only mới để align đầy đủ `OutboundMessage` và relation/enums liên quan với `schema.prisma`.
- Trạng thái: Đã fix, PASS reset/deploy/generate/build.

1. Prisma migration mismatch gây P3006/P1014 (đã xử lý)
- Triệu chứng: migration `20260214210000_outbound_worker_lease` `ALTER TABLE OutboundMessage` khi bảng chưa tồn tại trên DB sạch/shadow.
- File liên quan: `prisma/migrations/20260214210000_outbound_worker_lease/migration.sql`.
- Hướng xử lý: migration SQL idempotent, tự tạo enum/bảng tối thiểu nếu thiếu trước khi ALTER/INDEX.
- Trạng thái: Đã fix và verify PASS.

2. Port conflict local DB (đã xử lý)
- Triệu chứng: host có service/container khác chiếm `5432` và `6379`.
- File liên quan: `docker-compose.yml`, `.env.example`, `.env`.
- Hướng xử lý:
  - Postgres map `5433:5432`.
  - Redis map `6380:6379`.
  - Cập nhật `DATABASE_URL`/`REDIS_URL` tương ứng.
- Trạng thái: Đã fix và verify PASS.

3. API deny-by-default cần giữ allowlist công khai
- Kiểm tra: `middleware.ts` + `src/lib/route-permissions-map.ts`.
- Kết luận: `/api/health/*`, `/api/auth/*`, student auth/content và secret-header routes đã được allowlist.
- Trạng thái: PASS (không phát hiện redirect loop từ middleware trong phạm vi audit route-level).

4. Frontend auth guard có nguy cơ loop/loading vô hạn (đã xử lý)
- Vấn đề:
  - Guard cũ gom toàn bộ `AUTH_*` thành redirect login, có thể xử lý không đúng với `403`.
  - Thiếu timeout có thể dẫn đến loading kéo dài khi network treo.
- File liên quan:
  - `src/lib/ui-auth-guard.ts`
  - `src/app/(app)/layout.tsx`
- Hướng xử lý:
  - `401` -> redirect login.
  - `403` -> hiển thị “Bạn không có quyền truy cập” (không redirect loop).
  - network/db/timeout -> hiển thị lỗi + nút `Thử lại`.
  - timeout guard 10 giây.
- Trạng thái: PASS.

### P1
1. Chuẩn hóa script vận hành DB
- Thêm script `db:reset` vào `package.json` để runbook nhất quán.
- Trạng thái: Đã fix.

2. Playwright webServer local chưa ổn định trong sandbox
- Triệu chứng: lock `.next/dev/lock` hoặc treo startup webServer.
- File liên quan: `playwright.config.ts`, `tests/rbac-permissions.spec.ts`.
- Trạng thái: Đã chuyển sang `BASE_URL` bắt buộc + runner `build/start`, không phụ thuộc `next dev`.

3. Scope dữ liệu
- Rule đang áp dụng tại `src/lib/scope.ts`:
  - `admin` -> `SYSTEM`
  - `manager` có `branchId` -> `BRANCH`
  - role còn lại -> `OWNER`
- Áp dụng cho Leads/Students/Receipts/Schedule ở service/query layer.

### P2
1. Log/debug trong scripts
- `scripts/audit-route-permissions.ts`, `scripts/seed-*.ts`, `scripts/log-session.mjs` có output console (chấp nhận được cho CLI script).
- Trạng thái: Không phải blocker.

2. TODO trong docs
- Có TODO trong `docs/CODEX_AUDIT.md` nhưng không chặn runtime.

## Kiểm tra trùng rule permissions map
- `src/lib/route-permissions-map.ts`: không có duplicate key theo cặp `METHOD + pattern`.

## Kết luận
- Hệ thống local đã ổn định hơn cho macOS:
  - DB tránh conflict cổng phổ biến.
  - Migration chain chạy sạch trên DB mới.
  - Dev server chạy local ổn định qua wrapper script.
- Chuỗi migration đã có bước chuẩn hóa production cho `OutboundMessage` theo hướng forward-only, không rewrite lịch sử.
- Các bước chạy chuẩn được ghi tại `RUNBOOK_LOCAL.md`.
