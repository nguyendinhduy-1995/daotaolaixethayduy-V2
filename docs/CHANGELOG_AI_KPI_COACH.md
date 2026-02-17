# CHANGELOG_AI_KPI_COACH

## 1) Summary
- Đổi tên module hiển thị thành `Trợ lý công việc` (route giữ nguyên `/ai/kpi-coach`):
  - CRM chỉ cung cấp dữ liệu, ingest, hiển thị, feedback và tạo outbound action.
  - Không gọi AI trực tiếp từ app.
- Bổ sung `KpiTarget`, `GoalSetting` (DAILY/MONTHLY), `AiSuggestion`, `AiSuggestionFeedback`.
- Chuẩn hóa `Mục tiêu KPI`:
  - chỉ số chọn theo catalog (không nhập tự do),
  - validate theo vai trò,
  - hỗ trợ mục tiêu theo nhân sự (`ownerId` override).
- Chuẩn hóa KPI về phần trăm (%):
  - Trực Page: `Tỉ lệ lấy được số`.
  - Tư vấn: `Tỉ lệ hẹn từ data`, `Tỉ lệ đến từ hẹn`, `Tỉ lệ ký từ đến`.
- Chuẩn hóa hiển thị tiếng Việt đời thường trong module KPI/AI (vai trò, chỉ số, trạng thái màu, nội dung gợi ý).
- Thêm UI: `/ai/kpi-coach`, `/kpi/targets`, `/goals` + widget dashboard.
- Bổ sung contract API + docs blueprint n8n.

## 2) Files chính đã thay đổi
- Data/migration:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260217000000_ai_kpi_coach/migration.sql`
  - `prisma/migrations/20260217000500_ai_kpi_permission_modules/migration.sql`
  - `prisma/migrations/20260217001000_ai_goal_keys_not_null/migration.sql`
  - `prisma/migrations/20260217002000_ai_target_dayofweek_not_null/migration.sql`
  - `prisma/seed.ts`
- Service/API:
  - `src/lib/services/ai-kpi-coach.ts`
  - `src/app/api/kpi/targets/route.ts`
  - `src/app/api/goals/route.ts`
  - `src/app/api/ai/suggestions/route.ts`
  - `src/app/api/ai/suggestions/ingest/route.ts`
  - `src/app/api/ai/suggestions/[id]/feedback/route.ts`
  - `src/app/api/outbound/jobs/route.ts`
- RBAC/UI map/menu:
  - `src/lib/permission-keys.ts`
  - `src/lib/permissions.ts`
  - `src/lib/route-permissions-map.ts`
  - `src/lib/ui-permissions.ts`
  - `src/lib/admin-menu.ts`
  - `src/app/(app)/layout.tsx`
- UI pages:
  - `src/app/(app)/ai/kpi-coach/page.tsx`
  - `src/app/(app)/kpi/targets/page.tsx`
  - `src/app/(app)/goals/page.tsx`
  - `src/app/(app)/dashboard/page.tsx`
- Docs:
  - `N8N_WORKFLOWS_BLUEPRINT.md`
  - `API_INTEGRATION_SPEC.md`
  - `FEATURE_MAP_AND_RUNBOOK.md`
  - `ADMIN_GUIDE_UPDATE_NOTES.md`
  - `TEST_CHECKLIST_AI_KPI_COACH.md`

## 3) Quyết định kỹ thuật
- Dùng `Role` hiện có cho `KpiTarget.role` và `AiSuggestion.role`, validate subset nghiệp vụ cho target.
- `GoalSetting` dùng `branchScopeKey` để đảm bảo uniqueness cả trường hợp system-level (`branchId=null`).
- Ingest AI dùng `x-service-token` (`ACTIVE/NEXT`) + `Idempotency-Key` bắt buộc.
- Tạo outbound từ AI action qua endpoint riêng `/api/outbound/jobs` để tách khỏi dispatch worker.

## 4) Kết quả verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma db seed`: PASS
- `npx prisma migrate deploy`: PASS
- `BASE_URL=http://127.0.0.1:3000 npx playwright test tests/ai-kpi-coach.spec.ts`: FAIL trong sandbox (EPERM connect/browser launch), cần chạy lại trên local host không bị hạn chế quyền.
