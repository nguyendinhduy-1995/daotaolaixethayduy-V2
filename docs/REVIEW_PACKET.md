# REVIEW_PACKET

## A) Summary
- Đã tạo tài liệu nghiệp vụ full admin: `ADMIN_BUSINESS_FLOW.md`.
- Đã tạo API catalog dùng route thật: `src/lib/api-catalog.ts`.
- Đã tạo trang tra cứu tích hợp API Hub: `src/app/(app)/api-hub/page.tsx`.
- Đã bổ sung ma trận quyền theo role/module: `PERMISSION_MATRIX.md`.
- Đã bổ sung đặc tả tích hợp ngoài (auth, idempotency, webhook): `API_INTEGRATION_SPEC.md`.
- Đã triển khai RBAC theo nhóm quyền + override theo user (DB/API/UI/menu).
- Đã hardening RBAC deny-by-default cho `/api/**`, chuẩn hóa allowlist public/secret và audit coverage.
- Đã cập nhật `CHANGELOG_LOGIC.md` với mục "API Hub + Business Flow docs".
- Đã chuẩn hóa migration production theo hướng forward-only cho `OutboundMessage` bằng migration mới `20260216180000_outbound_message_alignment`.

## B) Files added/modified

### Files added
- `ADMIN_BUSINESS_FLOW.md`
- `REVIEW_PACKET.md`
- `src/lib/api-catalog.ts`
- `src/app/(app)/api-hub/page.tsx`
- `PERMISSION_MATRIX.md`
- `API_INTEGRATION_SPEC.md`
- `src/lib/permissions.ts`
- `src/lib/permission-keys.ts`
- `src/lib/route-permissions-map.ts`
- `src/lib/permission-utils.ts`
- `src/lib/ui-permissions.ts`
- `src/lib/scope.ts`
- `src/app/(app)/admin/phan-quyen/page.tsx`
- `src/app/api/admin/permission-groups/route.ts`
- `src/app/api/admin/permission-groups/[id]/route.ts`
- `src/app/api/admin/permission-groups/[id]/rules/route.ts`
- `src/app/api/admin/users/[id]/permission-overrides/route.ts`
- `prisma/migrations/20260216133000_rbac_permissions/migration.sql`
- `tests/rbac-permissions.spec.ts`
- `scripts/audit-route-permissions.ts`
- `docs/RBAC_HARDENING_REPORT.md`
- `PATCH_NOTES.md`
- `AUDIT_REPORT.md`
- `FIX_LOG.md`
- `RUNBOOK_LOCAL.md`
- `prisma/migrations/20260216180000_outbound_message_alignment/migration.sql`
- `scripts/select-port.mjs`
- `scripts/dev.mjs`
- `scripts/start.mjs`
- `scripts/check-schema.mjs`
- `scripts/run-e2e.mjs`
- `prisma/migrations/20260216193000_schema_gate_alignment/migration.sql`

### Files modified
- `CHANGELOG_LOGIC.md`
- `prisma/schema.prisma`
- `src/lib/route-auth.ts`
- `src/lib/route-permissions-map.ts`
- `src/app/api/auth/me/route.ts`
- `src/lib/auth-client.ts`
- `src/app/(app)/layout.tsx`
- `src/lib/admin-menu.ts`
- `src/components/mobile/MobileAdminMenu.tsx`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/receipts/route.ts`
- `src/app/api/receipts/[id]/route.ts`
- `src/app/api/schedule/route.ts`
- `src/app/api/schedule/[id]/route.ts`
- `src/app/api/schedule/[id]/attendance/route.ts`
- `src/app/api/leads/route.ts`
- `src/app/api/leads/[id]/route.ts`
- `src/app/api/leads/[id]/events/route.ts`
- `src/app/api/leads/assign/route.ts`
- `src/app/api/leads/auto-assign/route.ts`
- `src/app/api/admin/payroll/route.ts`
- `src/app/api/admin/payroll/generate/route.ts`
- `src/app/api/admin/payroll/finalize/route.ts`
- `src/app/api/admin/worker/outbound/route.ts`
- `src/app/api/automation/run/route.ts`
- `src/app/api/automation/logs/route.ts`
- `src/app/(app)/leads/page.tsx`
- `src/app/(app)/receipts/page.tsx`
- `src/app/(app)/automation/run/page.tsx`
- `src/lib/auth.ts`
- `src/lib/api-client.ts`
- `playwright.config.ts`
- `package.json`
- `PERMISSION_MATRIX.md`
- `API_INTEGRATION_SPEC.md`
- `tests/rbac-permissions.spec.ts` (dùng `BASE_URL` fallback `http://127.0.0.1:3000`)
- `src/lib/ui-auth-guard.ts`
- `src/app/(app)/layout.tsx`
- `scripts/verify-gate.mjs`

## C) Hướng dẫn mở trang
- Chạy DB local (tránh conflict cổng 5432 của hệ thống khác):
- `docker compose up -d`
- Postgres map `localhost:5433 -> container:5432`
- Redis map `localhost:6380 -> container:6379`
- Reset migration trên DB sạch:
- `npx prisma migrate reset --force`
- Chạy local server mới:
- `npm run dev` (tự bind `127.0.0.1`, tự chọn port trống: ưu tiên `3000`, fallback `3005`)
- `PORT=3005 npm run dev` (ép port cụ thể nếu muốn)
- `HOSTNAME=127.0.0.1 PORT=3000 npm run start` (sau khi `npm run build`)
- Chạy Playwright với server ngoài (không tự start webServer):
- `BASE_URL=http://127.0.0.1:3000 npx playwright test tests/rbac-permissions.spec.ts`
- Chạy e2e chuẩn local (không dùng `next dev`):
- `npm run test:e2e` (tự chạy `build + start` ở cổng cố định rồi chạy Playwright).
- Chạy Playwright CI/remote:
- `BASE_URL=https://your-env.example.com npx playwright test`
- API Hub: `http://localhost:3000/api-hub`
- Quản trị phân quyền: `http://localhost:3000/admin/phan-quyen`
- Các trang Admin chính:
- `http://localhost:3000/dashboard`
- `http://localhost:3000/leads`
- `http://localhost:3000/kpi/daily`
- `http://localhost:3000/students`
- `http://localhost:3000/courses`
- `http://localhost:3000/schedule`
- `http://localhost:3000/receipts`
- `http://localhost:3000/admin/ops`
- `http://localhost:3000/admin/n8n`

## D) Checklist self-check
- UI tiếng Việt 100%: Đạt (API Hub + business flow docs dùng tiếng Việt).
- API catalog không bịa route: Đạt (mọi path trong catalog đều tồn tại trong `src/app/api/**/route.ts`).
- Ví dụ curl chạy được ở mức format: Đạt (dùng token `REDACTED`, cú pháp shell hợp lệ).
- Đã có auth spec, idempotency, webhook contract: Đạt (`API_INTEGRATION_SPEC.md` + section Tích hợp trong API Hub).
- RBAC group + user override: Đạt (API quản trị + page `/admin/phan-quyen`).
- Route nhạy cảm đã enforce module/action: Đạt (users/receipts/schedule/leads assign/payroll/automation).
- Schema gate production: Đạt (`npm run check:schema` pass).

## E) Test nhanh phân quyền
1. Đăng nhập admin, mở `/admin/phan-quyen`, tạo nhóm mới và tắt quyền `admin_users:VIEW`.
2. Gán nhóm đó cho user thường tại tab `Phân quyền theo người dùng`.
3. Đăng nhập user thường:
- Không thấy menu `Người dùng`/`Phân quyền`.
- Gọi `GET /api/admin/users` trả `403 AUTH_FORBIDDEN`.
4. Đăng nhập admin full quyền:
- Mở được `/admin/users`, gọi `GET /api/admin/users` thành công.

## F) Kết quả verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run audit:permissions`: PASS (`Total route methods: 114`, không có route thiếu map ngoài whitelist public)
- `npm run verify`: PASS (`lint + build + audit:permissions + check:schema`)
- `npm run dev`: PASS
  - Log: `[dev] HOSTNAME=127.0.0.1 PORT=3000` và Next.js sẵn sàng tại `http://127.0.0.1:3000`.
- `docker compose up -d postgres`: PASS
- `npx prisma migrate reset --force`: PASS (Datasource tại `localhost:5433`)
- `npx prisma migrate deploy`: PASS (No pending migrations)
- `npx prisma generate`: PASS
- `npm run check:schema`: PASS
  - `No difference detected.`
  - `Schema gate PASS: DB schema khớp prisma/schema.prisma.`
- Smoke API: `curl -i http://127.0.0.1:3000/api/health/db`: PASS (`HTTP/1.1 200 OK`, `{\"ok\":true,\"db\":\"connected\"}`)
- `npx playwright test tests/rbac-permissions.spec.ts`: chưa chạy trong vòng verify này nếu không set `BASE_URL`.
  - Cấu hình mới yêu cầu `BASE_URL` và không tự spin webServer.
- Chuẩn hóa migration forward-only OutboundMessage:
  - `npx prisma migrate reset --force`: PASS (áp dụng cả migration `20260216180000_outbound_message_alignment`).
  - `npx prisma migrate deploy`: PASS.
  - `npx prisma generate`: PASS.
  - `npm run build`: PASS.

## G) Production deploy steps
1. Deploy code + cấu hình env production.
2. Chạy `npx prisma migrate deploy`.
3. Chạy `npm run check:schema` để chặn drift schema.
4. Chạy app với `npm run start`.

## Ghi chú
- Ví dụ curl trong API Hub chỉ để mẫu tích hợp; không chứa token thật.

## Cập nhật mới: Auth loop fix (`/login`, `/api/auth/me`)
- Đã sửa phân loại auth chuẩn:
  - Thiếu/sai/hết hạn token => `401`
  - Thiếu quyền => `403`
- Đã sửa `/api/auth/me` không còn trả message kiểu forbidden cho token lỗi.
- Đã sửa guard login để không redirect loop ở `/login`.
- Đã thêm test trong `tests/rbac-permissions.spec.ts`:
  - `/api/auth/me` không token => `401 AUTH_MISSING_BEARER`
  - `/api/auth/me` token rác => `401 AUTH_INVALID_TOKEN`
  - token hợp lệ nhưng thiếu quyền => `403 AUTH_FORBIDDEN`
- Chi tiết thay đổi: `CHANGELOG_AUTH_LOOP_FIX.md`.
- Verify nhanh:
  - `npm run lint`: PASS
  - `npm run build`: PASS

## Cập nhật mới: Spinner/redirect loop fix (`/`, `/login`, `/api-hub`)
- Đã triage call chain:
  - `src/app/(app)/layout.tsx` -> `src/lib/ui-auth-guard.ts` -> `/api/auth/me`
  - `src/app/login/page.tsx`
  - `src/app/page.tsx`
  - `src/app/(app)/api-hub/page.tsx`
- Root cause chính: `src/app/page.tsx` dùng sai kiểu trả về của `guardByAuthMe`, dẫn tới redirect chồng nhau.
- Đã thêm `useRef` lock để guard chạy 1 lần ở các route/layout liên quan.
- Đã bổ sung logging guard state transitions khi bật `DEBUG=1`.
- Đã thêm test Playwright cho:
  - `/login` unauthenticated render bình thường, không loop.
  - `/dashboard` unauthenticated redirect `/login` một lần.
- Chi tiết đầy đủ: `CHANGELOG_SPINNER_LOOP_FIX.md`.
- Verify:
  - `npm run lint`: PASS
  - `npm run build`: PASS
  - `npm run dev`: PASS
  - `BASE_URL=http://127.0.0.1:3000 npx playwright test tests/rbac-permissions.spec.ts`: FAIL do môi trường sandbox chặn socket/browser (`EPERM`), cần chạy lại trên máy local không bị hạn chế quyền.

## Cập nhật mới: Seed dữ liệu nghiệp vụ
- Đã thêm seed tổng deterministic tại `prisma/seed.ts`.
- Đăng nhập hỗ trợ `email OR username(name)`, tài khoản quản trị chính:
  - `Nguyendinhduy / Nguyendinhduy@95`
- Tài liệu:
  - `SEED_RUNBOOK.md`
  - `CHANGELOG_SEED.md`
  - `QUICK_TEST.md`
- Verify:
  - `npm run lint`: PASS
  - `npm run build`: PASS
  - `npx prisma migrate reset --force`: PASS
  - `npx prisma db seed`: PASS

## Cập nhật mới: Module Chi phí vận hành
- Đã thêm models Prisma:
  - `ExpenseCategory`
  - `BranchExpenseDaily`
  - `BranchBaseSalary`
  - `ExpenseInsight`
- Đã thêm API:
  - `GET/POST /api/expenses/daily`
  - `GET /api/expenses/summary`
  - `GET/POST /api/expenses/base-salary`
  - `GET /api/insights/expenses`
  - `POST /api/insights/expenses/ingest` (service-token)
- Đã thêm UI:
  - `/expenses/daily`
  - `/expenses/monthly`
  - Dashboard widget tổng chi phí tháng.
- Đã fix lỗi migration enum thứ tự sai bằng migration mới:
  - `prisma/migrations/20260216210000_permission_enum_expenses_finalize/migration.sql`
- Verify module chi phí:
  - `npx prisma migrate reset --force`: PASS
  - `npx prisma migrate deploy`: PASS
  - `npx prisma generate`: PASS
  - `npx prisma db seed`: PASS
  - `npm run verify`: PASS

## Cập nhật mới: Hardening Pass P0 (identity/scope/idempotency/guide)
- Identity:
  - Thêm `User.username` unique, login theo `email OR username`.
  - UI login đổi label `Tài khoản (username hoặc email)`.
- Scope:
  - Chuẩn hóa scope utility ở `src/lib/scope.ts` với `getAllowedBranchIds`, `enforceBranchScope`, `whereBranchScope`.
  - `FINAL HARDENING v2`: áp dụng 2-phase migration để đưa `branchId` thành NOT NULL cho các entity chính.
- Idempotency:
  - Thêm bảng `IdempotencyRequest`.
  - Enforce `Idempotency-Key` cho POST quan trọng: receipts/schedule/outbound dispatch/insights ingest.
- Ingest hardening:
  - `x-service-token` dùng một biến duy nhất `SERVICE_TOKEN`.
  - Payload bắt buộc `source='n8n'` + `runId`.
  - Rate limit nhẹ cho ingest.
- Admin Guide:
  - Thêm trang `/admin/guide` đọc `FEATURE_MAP_AND_RUNBOOK.md`, có search + accordion + badge quyền.

## Cập nhật mới: FINAL HARDENING v2
- Branch safety:
  - Thêm backfill script `scripts/backfill-branch-id.mjs`.
  - Thêm migration phase 1 (manual): `prisma/migrations/20260216232000_branch_backfill_phase1_manual/migration.sql`.
  - Thêm migration phase 2 (NOT NULL + FK): `prisma/migrations/20260216233000_branch_not_null_phase2/migration.sql`.
  - `branchId` đã bắt buộc ở `Lead`, `Student`, `Receipt`, `CourseScheduleItem`, `AutomationLog`, `OutboundMessage`.
- Scope unify:
  - Rule chuẩn: admin SYSTEM, manager BRANCH, telesales/direct_page OWNER + BRANCH.
  - Enforce ở leads/receipts/schedule/students/outbound/automation logs.
- Idempotency policy:
  - TTL 72h; key bắt buộc cho create quan trọng.
  - `IdempotencyRequest` lưu đủ `key, route, actorType, actorId, requestHash, responseJson, statusCode, createdAt`.
- Ingest hardening:
  - `/api/insights/expenses/ingest` xác thực bằng `SERVICE_TOKEN`.
  - Payload bắt buộc `source='n8n'` và `runId`.
- Verify mới nhất:
  - `npm run lint`: PASS
  - `npm run build`: PASS
  - `npm run verify`: PASS
  - `npx prisma migrate reset --force`: PASS
  - `npx prisma db seed`: PASS
  - `node scripts/backfill-branch-id.mjs`: PASS (xem `artifacts/ORPHAN_RECORDS.md`)
  - `npm run test:e2e:local`: FAIL best-effort trong sandbox do Turbopack bind/process permission (`Operation not permitted`), cần chạy lại trên local host không bị hạn chế.

## Cập nhật mới: Trợ lý công việc (n8n-driven)
- Data model mới:
  - `KpiTarget` (target theo role/branch/dayOfWeek)
  - `GoalSetting` (mục tiêu DAILY/MONTHLY)
  - `AiSuggestion` + `AiSuggestionFeedback`
- API mới:
  - `GET/POST /api/kpi/targets`
  - `GET/POST /api/goals`
  - `GET /api/ai/suggestions`
  - `POST /api/ai/suggestions/ingest` (service-token + idempotency)
  - `POST /api/ai/suggestions/{id}/feedback`
  - `POST /api/outbound/jobs` (idempotency)
- UI mới:
  - `/ai/kpi-coach`
  - `/kpi/targets`
  - `/goals`
  - Dashboard widget `AI gợi ý hôm nay`.
- RBAC:
  - thêm module `kpi_targets`, `goals`, `ai_kpi_coach`.
  - deny-by-default giữ nguyên, route mới đã map đầy đủ.
- Docs mới:
  - `PLAN.md`
  - `CHANGELOG_AI_KPI_COACH.md`
  - `N8N_WORKFLOWS_BLUEPRINT.md`
  - `ADMIN_GUIDE_UPDATE_NOTES.md`
  - `TEST_CHECKLIST_AI_KPI_COACH.md`
- Verify:
  - `npm run lint`: PASS
  - `npm run build`: PASS
  - `npm run verify`: PASS
  - `npx prisma migrate reset --force`: PASS
  - `npx prisma db seed`: PASS
  - `npx prisma migrate deploy`: PASS
  - Playwright smoke Trợ lý công việc: FAIL trong sandbox do EPERM network/browser; cần chạy lại trên máy local để xác nhận e2e.
- Verify hardening:
  - `npm run lint`: PASS
  - `npm run build`: PASS
  - `npm run verify`: PASS
  - `npx prisma migrate reset --force`: PASS
  - `npx prisma db seed`: PASS
- Smoke curl:
  - `GET /api/health/db` => `200`
  - `GET /api/auth/me` (no token) => `401 AUTH_MISSING_BEARER`
  - Login `Nguyendinhduy / Nguyendinhduy@95` => `200` + trả `user.username = \"Nguyendinhduy\"`
