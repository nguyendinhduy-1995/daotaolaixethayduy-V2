# CODEBASE_NOTES

## 1) Tổng quan dự án
- Mục tiêu: CRM vận hành tuyển sinh/đào tạo, gom sale pipeline + học viên + tài chính + outbound + HR payroll trong một hệ thống.  
  File: `README.md`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/layout.tsx`
- Domain chính:
  - Lead/Telesales pipeline: `src/lib/lead-events.ts`, `src/app/api/leads/route.ts`
  - Student/Course/Schedule/Attendance: `src/app/api/students/route.ts`, `src/app/api/courses/route.ts`, `src/app/api/schedule/route.ts`
  - Finance/Receipts: `src/app/api/receipts/route.ts`, `src/app/api/receipts/summary/route.ts`
  - Ops Pulse/KPI/Marketing/n8n ingest: `src/lib/services/ops-pulse.ts`, `src/lib/services/kpi-daily.ts`, `src/lib/services/marketing.ts`
  - Automation outbound: `src/lib/services/cron-daily.ts`, `src/lib/services/outbound-worker.ts`
  - HR payroll/commission: `src/lib/services/payroll.ts`, `src/lib/services/commission-paid50.ts`
- Luồng chính:
  - User login -> thao tác UI -> gọi API App Router (`src/app/api/**/route.ts`) -> service layer (`src/lib/services/**`) -> Prisma (`src/lib/prisma.ts`).

## 2) Tech stack + tooling
- Framework: Next.js App Router + React + TypeScript.  
  File: `package.json`, `next.config.ts`, `tsconfig.json`
- DB: PostgreSQL + Prisma ORM + Prisma PG adapter.  
  File: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/prisma.ts`
- Cache/queue phụ trợ: Redis local compose.  
  File: `docker-compose.yml`
- Auth: JWT + cookie/bearer hybrid.  
  File: `src/lib/jwt.ts`, `src/lib/auth.ts`, `middleware.ts`
- Lint/build/tooling:
  - Lint: ESLint (`npm run lint`) -> `eslint.config.mjs`
  - Build: Next build (`npm run build`)
  - Verify end-to-end script: `scripts/verify.sh`
  - Seed: `scripts/seed-admin.ts`, `scripts/seed-templates.ts`

## 3) Cấu trúc thư mục + vai trò
- `src/app/`: UI pages + API routes.
  - `src/app/(app)/`: backoffice pages (admin, ops, hr, marketing, leads, students, receipts, outbound).
  - `src/app/api/`: backend endpoints theo App Router.
  - `src/app/student/`: student portal.
- `src/lib/`: business logic và infra helpers.
  - Auth/RBAC helpers: `src/lib/auth.ts`, `src/lib/route-auth.ts`, `src/lib/admin-auth.ts`
  - Services: `src/lib/services/*`
  - API error format: `src/lib/api-response.ts`
- `src/components/`: UI primitives và admin/mobile components.
  - `src/components/ui/*`
  - `src/components/admin/*`
  - `src/components/mobile/*`
- `prisma/`: schema + migrations SQL.
  - `prisma/schema.prisma`
  - `prisma/migrations/*`
- `scripts/`: verify/seed/worker helper scripts.
- `docs/`: audit, worklog, n8n docs.
- Bản đồ nhanh repo: `REPO_MAP.md`

## 4) Database (Prisma): models/relations/enums chính
- Core entities:
  - `User`, `Branch` (RBAC, tổ chức): `prisma/schema.prisma`
  - `Lead`, `LeadEvent`, `LeadMessage` (pipeline sale)
  - `Student`, `Course`, `CourseScheduleItem`, `Attendance*` (đào tạo/điểm danh)
  - `Receipt`, `TuitionPlan` (thu học phí)
  - `Notification`, `OutboundMessage`, `AutomationLog`, `MessageTemplate` (automation/outbound)
  - `MarketingReport`, `OpsPulse`, `EmployeeKpiSetting` (marketing + ops + KPI nhân sự)
  - `SalaryProfile`, `CommissionLedger`, `PayrollRun`, `PayrollItem` (HR/payroll)
- Business relations nổi bật:
  - `Lead.ownerId -> User`
  - `Student.leadId (unique) -> Lead`
  - `Receipt.studentId -> Student`
  - `OpsPulse.ownerId -> User`, `OpsPulse.branchId -> Branch`
  - `MarketingReport.branchId -> Branch`
  - `PayrollRun.branchId -> Branch`, `PayrollItem.payrollRunId -> PayrollRun`
- Enums chính:
  - Sales: `Role`, `LeadStatus`, `LeadEventType`
  - Ops/KPI: `OpsPulseRole`, `EmployeeKpiRole`
  - Finance/HR: `ReceiptMethod`, `CommissionSourceType`, `PayrollStatus`, `HrAttendanceStatus`
  File: `prisma/schema.prisma`

## 5) API: endpoints quan trọng, auth, error format, helpers
- API style: App Router `src/app/api/**/route.ts` (không dùng `src/pages/api/**`).
- Auth patterns:
  - Bearer/cookie auth: `requireRouteAuth` / `requireAuth`  
    File: `src/lib/route-auth.ts`, `src/lib/auth.ts`
  - Admin check: `requireAdminRole`  
    File: `src/lib/admin-auth.ts`
  - Secret header endpoints (machine-to-machine):
    - `POST /api/ops/pulse` -> `src/app/api/ops/pulse/route.ts`
    - `POST /api/marketing/report` -> `src/app/api/marketing/report/route.ts`
    - `POST /api/cron/daily` -> `src/app/api/cron/daily/route.ts`
    - `POST /api/worker/outbound` -> `src/app/api/worker/outbound/route.ts`
    - `POST /api/outbound/callback` -> `src/app/api/outbound/callback/route.ts`
- Nhóm endpoint quan trọng:
  - Auth/session: `/api/auth/login|me|refresh|logout`
  - KPI/Ops: `/api/kpi/daily`, `/api/ops/pulse`, `/api/admin/ops/pulse`, `/api/admin/employee-kpi`
  - Marketing: `/api/marketing/report`, `/api/admin/marketing/reports` (+ deprecated ingest/metrics)
  - Leads/Students/Courses/Schedule: `/api/leads*`, `/api/students*`, `/api/courses*`, `/api/schedule*`
  - Receipts/Finance: `/api/receipts*`
  - Automation/outbound: `/api/notifications*`, `/api/automation/*`, `/api/outbound/*`
- Error format chuẩn:
```json
{
  "ok": false,
  "error": { "code": "VALIDATION_ERROR", "message": "..." }
}
```
  File: `src/lib/api-response.ts`
- Middleware bảo vệ UI routes và admin guard server-side verify:
  File: `middleware.ts`

## 6) UI: pages/screens chính, flow, components nổi bật
- Shell/layout + navigation:
  - `src/app/(app)/layout.tsx`
  - `src/components/mobile/MobileBottomNav.tsx`
- Màn hình nghiệp vụ chính:
  - Dashboard: `src/app/(app)/dashboard/page.tsx`
  - Leads list/board/detail: `src/app/(app)/leads/page.tsx`, `src/app/(app)/leads/board/page.tsx`, `src/app/(app)/leads/[id]/page.tsx`
  - Students/Courses/Schedule: `src/app/(app)/students/page.tsx`, `src/app/(app)/courses/page.tsx`, `src/app/(app)/schedule/page.tsx`
  - KPI/Ops/Marketing: `src/app/(app)/kpi/daily/page.tsx`, `src/app/(app)/admin/ops/page.tsx`, `src/app/(app)/marketing/page.tsx`, `src/app/(app)/admin/n8n/page.tsx`
  - HR: `src/app/(app)/hr/kpi/page.tsx`, `src/app/(app)/hr/payroll/page.tsx`
  - Outbound/Automation: `src/app/(app)/outbound/page.tsx`, `src/app/(app)/automation/logs/page.tsx`, `src/app/(app)/automation/run/page.tsx`
  - Student portal: `src/app/student/*`
- Components nổi bật:
  - UI kit: `src/components/ui/*`
  - Admin responsive list/filter: `src/components/admin/*`

## 7) Config & ENV (chỉ tên biến)
- File mẫu local: `.env.example`
- Biến chính cần có:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `N8N_WEBHOOK_URL`
  - `N8N_CALLBACK_SECRET`
  - `CRON_SECRET`
  - `OPS_SECRET`
  - `MARKETING_SECRET`
  - `OPS_TZ`
  - `OPS_QUIET_HOURS`
  - `OPS_MAX_PER_RUN`
  - `OPS_MAX_PER_OWNER`
  - `OPS_DEDUPE_WINDOW_DAYS`
  - `WORKER_SECRET`
  - `WORKER_CONCURRENCY`
  - `WORKER_RATE_LIMIT_PER_MIN`
  - `WORKER_RATE_LIMIT_PER_OWNER_PER_MIN`
  - `WORKER_LEASE_SECONDS`
  - `WORKER_BATCH_SIZE`
  - `WORKER_TZ`
- Cách set local:
  - `cp .env.example .env`
  - chỉnh giá trị local, không commit secrets; nếu cần chia sẻ thì dùng `REDACTED`.

## 8) Cách chạy local
- Prerequisites: Node 20+, npm, Docker.
- Install:
```bash
npm install
```
- Start services:
```bash
npm run db:up
```
- Migrate + generate + seed:
```bash
npm run db:migrate
npm run prisma:generate
npm run db:seed
```
- Dev:
```bash
npm run dev
```
- Lint + build:
```bash
npm run lint
npm run build
```
- Full verify script:
```bash
npm run verify
```
- Docker down:
```bash
npm run db:down
```
Files: `README.md`, `package.json`, `docker-compose.yml`, `scripts/verify.sh`

## 9) Điểm cần chú ý (gotchas) + TODO/Next steps
- Gotchas:
  - Timezone business logic dùng HCM (+07), đặc biệt KPI/ops dateKey; sai timezone dễ lệch số.  
    File: `src/lib/services/kpi-daily.ts`, `src/lib/services/ops-pulse.ts`
  - Có endpoint deprecated marketing vẫn mở để backward compatibility (`/api/marketing/ingest`, `/api/marketing/metrics`).  
    File: `src/app/api/marketing/ingest/route.ts`, `src/app/api/marketing/metrics/route.ts`
  - RBAC gồm middleware + API-level checks; khi thêm route mới phải gắn cả hai lớp.  
    File: `middleware.ts`, `src/lib/route-auth.ts`, `src/lib/admin-auth.ts`
  - Worker/outbound có lease + retry; test cần cover race/idempotency.  
    File: `src/lib/services/outbound-worker.ts`
- TODO/Next steps thực tế:
  - Viết test tích hợp cho contracts n8n ingest (ops/marketing/worker/callback).  
    Target: `src/app/api/ops/pulse/route.ts`, `src/app/api/marketing/report/route.ts`, `src/app/api/worker/outbound/route.ts`, `src/app/api/outbound/callback/route.ts`
  - Chuẩn hóa docs API thành OpenAPI hoặc JSON schema để sync với n8n workflow.  
    Input docs: `docs/n8n/api.md`
  - Tối ưu observability cho automation (latency/error-rate dashboards).  
    Sources: `AutomationLog`, `OpsPulse`, `MarketingReport`
  - Dọn hẳn deprecated marketing endpoints khi client external đã migrate.
