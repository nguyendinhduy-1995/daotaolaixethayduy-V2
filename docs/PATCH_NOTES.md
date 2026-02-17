# PATCH_NOTES

## Tóm tắt
Bản vá này tập trung hardening RBAC theo hướng deny-by-default cho API, siết coverage audit route-permission, chuẩn hóa enforce helper ở handler, và bổ sung kiểm thử RBAC.

## Prisma migration fix (P3006/P1014)
- Nguyên nhân:
  - Migration `20260214210000_outbound_worker_lease` thực hiện `ALTER TABLE "OutboundMessage"` nhưng không có migration nào trước đó tạo bảng `OutboundMessage`.
  - Khi chạy shadow DB / DB sạch, Prisma báo:
    - `P3006` (migration không apply cleanly)
    - `P1014` (underlying table for model `OutboundMessage` does not exist)
- Thay đổi:
  - Sửa file `prisma/migrations/20260214210000_outbound_worker_lease/migration.sql` theo hướng idempotent:
    - Tạo enum nếu thiếu: `OutboundChannel`, `OutboundStatus`, `OutboundPriority`.
    - Tạo bảng `OutboundMessage` nếu thiếu (cột nền + PK).
    - Thêm FK `leadId`, `studentId` nếu chưa có.
    - Giữ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` và thêm index `IF NOT EXISTS`.
- Lệnh verify đã chạy:
  - `npx prisma migrate reset --force`: PASS
  - `npx prisma migrate deploy`: PASS
  - `npx prisma generate`: PASS

## Prisma production hardening (forward-only)
- Bối cảnh:
  - Migration `20260214210000_outbound_worker_lease` từng chứa logic “tự tạo bảng tối thiểu”.
  - Cách này không lý tưởng cho production vì migration lease nên chỉ xử lý lease/index, không gánh schema nền.
- Quyết định triển khai:
  - Không rewrite migration lịch sử (tránh rủi ro nếu đã deploy).
  - Thêm migration mới `20260216180000_outbound_message_alignment` theo hướng forward-only.
- Nội dung migration mới:
  - Align đầy đủ enums/tables/FK/index/default cho `OutboundMessage` và entities liên quan (`Notification`, `MessageTemplate`, `NotificationRule`) theo `schema.prisma`.
  - Chạy được trên DB sạch và DB đã từng có bảng tối thiểu.
- Verify:
  - `docker compose up -d`: PASS
  - `npx prisma migrate reset --force`: PASS
  - `npx prisma migrate deploy`: PASS
  - `npx prisma generate`: PASS
  - `npm run build`: PASS

## Repo audit + auto-fix (ổn định local macOS)
- Port conflict DB:
  - `docker-compose.yml`: Postgres host port `5433:5432`, Redis host port `6380:6379`.
  - `.env.example`: `DATABASE_URL` -> `localhost:5433`, `REDIS_URL` -> `localhost:6380`.
  - `.env`: `DATABASE_URL` -> `localhost:5433`.
- Scripts:
  - `package.json`: thêm `db:reset` để chuẩn hóa runbook local.
- Tài liệu vận hành:
  - Thêm `AUDIT_REPORT.md`, `FIX_LOG.md`, `RUNBOOK_LOCAL.md`.
  - Cập nhật `REVIEW_PACKET.md` theo kết quả verify mới.
- Verify runtime local:
  - `docker compose up -d postgres`: PASS
  - `npx prisma migrate reset --force`: PASS
  - `npx prisma migrate deploy`: PASS
  - `npx prisma generate`: PASS
  - `npm run dev` + `GET /api/health/db`: PASS (`HTTP 200`, `{\"ok\":true,\"db\":\"connected\"}`)

## Production gate chuẩn hóa
- Prisma schema gate:
  - Thêm script `check:schema` (`node scripts/check-schema.mjs`).
  - Flow gate: `migrate deploy` -> `migrate diff --from-config-datasource --to-schema ... --exit-code`.
  - Fail nếu DB schema lệch `prisma/schema.prisma`.
- Playwright/CI:
  - `playwright.config.ts` yêu cầu `BASE_URL`, không tự spin webServer.
  - Không dùng `next dev` cho e2e runner.
  - Thêm `scripts/run-e2e.mjs`: chạy `build + start` (port cố định), healthcheck, rồi chạy Playwright.
- Drift alignment migration:
  - Thêm `prisma/migrations/20260216193000_schema_gate_alignment/migration.sql`.
  - Xóa default không mong muốn trên nhiều cột `updatedAt` và `OpsPulse.bucketStart`, rename index `OpsPulse...` để khớp schema gate.
- Verify:
  - `npm run build`: PASS
  - `npx prisma migrate deploy`: PASS
  - `npm run check:schema`: PASS (`No difference detected`)

## Auth/RBAC guard stabilization
- Public allowlist:
  - `src/lib/route-permissions-map.ts` mở rộng pattern cho `/api/health/*` và `/api/auth/*`.
- Frontend auth guard:
  - `src/lib/ui-auth-guard.ts` trả trạng thái rõ ràng: `ok|unauthorized|forbidden|error`.
  - `401` -> về login.
  - `403` -> không redirect loop, hiển thị “Bạn không có quyền truy cập”.
  - network/db lỗi -> hiển thị lỗi + nút `Thử lại`.
  - timeout guard 10 giây để tránh loading spinner vô hạn.
- UI fallback:
  - `src/app/(app)/layout.tsx` thêm màn hình fallback cho `403` và `error`.

## Verify pipeline
- Thêm `scripts/verify-gate.mjs` và đổi `npm run verify`:
  - `lint + build + audit:permissions + check:schema`.
  - Chạy Playwright khi có `BASE_URL`.
- Kết quả: `npm run verify` PASS trong môi trường local hiện tại.

## Files added
- `docs/RBAC_HARDENING_REPORT.md`: báo cáo hardening RBAC (deny-by-default, allowlist, audit, scope).
- `PATCH_NOTES.md`: nhật ký patch theo file.
- `scripts/select-port.mjs`: chọn cổng trống ổn định cho local (ưu tiên `PORT env`, nếu bận tăng dần; không có env thì ưu tiên 3000 rồi 3005).
- `scripts/dev.mjs`: wrapper `next dev` luôn bind `127.0.0.1`, tự chọn port trống.
- `scripts/start.mjs`: wrapper `next start` luôn bind `127.0.0.1`, dùng `PORT env`.

## Files modified
- `middleware.ts`: deny-by-default cho `/api/**`; route không map quyền và không allowlist trả `403 AUTH_FORBIDDEN`.
- `src/lib/route-permissions-map.ts`: chuẩn hóa `PUBLIC_API_ROUTES`, `SECRET_AUTH_ROUTES`, helper allowlist, và danh sách mapping route->module/action.
- `scripts/audit-route-permissions.ts`: bắt buộc coverage route và enforce helper hợp lệ (`requireMappedRoutePermissionAuth` hoặc `requirePermissionRouteAuth`).
- `src/lib/route-auth.ts`: `requireMappedRoutePermissionAuth` trả `403` khi route thiếu mapping.
- `src/lib/scope.ts`: helper resolve scope SYSTEM/BRANCH/OWNER và apply scope vào where-query.
- `playwright.config.ts`: cải thiện cấu hình webServer/port cho Playwright.
- `package.json`: đổi script `dev/start` sang wrapper mới để tránh lỗi `EPERM/EADDRINUSE` trên macOS local.
- `playwright.config.ts`: webServer chạy qua `npm run dev` với `HOSTNAME=127.0.0.1` và `PORT` theo `PW_PORT`/`PORT`, tránh hardcode port cứng.
- `playwright.config.ts`: cho phép nhận `BASE_URL` từ env; nếu đã có `BASE_URL` thì không tự start `webServer`.
- `playwright.config.ts`: chuyển lệnh webServer sang `node scripts/dev.mjs`.
- `tests/rbac-permissions.spec.ts`: bổ sung test:
  - route thiếu mapping => `403 AUTH_FORBIDDEN`
  - route allowlist public/secret không bị chặn sai bởi middleware RBAC
  - scope owner: user không thấy dữ liệu owner khác
- `tests/rbac-permissions.spec.ts`: dùng `process.env.BASE_URL` (fallback `http://127.0.0.1:3000`) để gọi API/page ổn định hơn khi chạy local/CI.

### Route handlers đã chuẩn hóa enforce helper
- `src/app/api/admin/attendance/route.ts`
- `src/app/api/admin/attendance/[id]/route.ts`
- `src/app/api/admin/branches/route.ts`
- `src/app/api/admin/branches/[id]/route.ts`
- `src/app/api/admin/commissions/route.ts`
- `src/app/api/admin/commissions/rebuild/route.ts`
- `src/app/api/admin/commissions/paid50/rebuild/route.ts`
- `src/app/api/admin/cron/daily/route.ts`
- `src/app/api/admin/employee-kpi/route.ts`
- `src/app/api/admin/employee-kpi/[id]/route.ts`
- `src/app/api/admin/marketing/ingest/route.ts`
- `src/app/api/admin/marketing/report/route.ts`
- `src/app/api/admin/marketing/reports/route.ts`
- `src/app/api/admin/n8n/workflows/route.ts`
- `src/app/api/admin/ops/pulse/route.ts`
- `src/app/api/admin/salary-profiles/route.ts`
- `src/app/api/admin/salary-profiles/[id]/route.ts`
- `src/app/api/admin/scheduler/health/route.ts`
- `src/app/api/admin/student-content/route.ts`
- `src/app/api/admin/student-content/[id]/route.ts`
- `src/app/api/courses/route.ts`
- `src/app/api/courses/[id]/route.ts`
- `src/app/api/courses/[id]/schedule/route.ts`
- `src/app/api/kpi/daily/route.ts`
- `src/app/api/marketing/metrics/route.ts`
- `src/app/api/me/payroll/route.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/[id]/route.ts`
- `src/app/api/notifications/generate/route.ts`
- `src/app/api/outbound/dispatch/route.ts`
- `src/app/api/outbound/messages/route.ts`
- `src/app/api/receipts/summary/route.ts`
- `src/app/api/scheduler/health/route.ts`
- `src/app/api/students/route.ts`
- `src/app/api/students/[id]/route.ts`
- `src/app/api/students/[id]/finance/route.ts`
- `src/app/api/tuition-plans/route.ts`
- `src/app/api/tuition-plans/[id]/route.ts`

## Verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run audit:permissions`: PASS
- `npx playwright test tests/rbac-permissions.spec.ts`: FAIL (môi trường chạy hiện tại không mở webServer ổn định trên port local)
