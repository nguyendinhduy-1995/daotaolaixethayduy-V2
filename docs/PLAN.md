# PLAN — AI KPI COACH (n8n-driven)

## Phạm vi đọc repo đã thực hiện
- Đã rà các khối chính: `prisma/schema.prisma`, seed (`prisma/seed.ts`), RBAC (`src/lib/permission-keys.ts`, `src/lib/permissions.ts`, `src/lib/route-permissions-map.ts`), auth/guard (`src/lib/route-auth.ts`, `middleware.ts`, `src/lib/ui-permissions.ts`), KPI/outbound (`src/app/api/kpi/daily/route.ts`, `src/app/api/outbound/*`), UI admin (`src/app/(app)/layout.tsx`, `src/lib/admin-menu.ts`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/api-hub/page.tsx`, `src/app/(app)/admin/guide/page.tsx`).

## Mục tiêu triển khai
- Thêm data model cho KPI target, goal ngày/tháng, gợi ý AI và feedback.
- App chỉ ingest/display/feedback/action outbound; không gọi AI trực tiếp.
- Tất cả route mới phải vào deny-by-default map + enforce scope + idempotency theo chuẩn hiện tại.

## Kế hoạch thay đổi theo lớp

### 1) Prisma + migration + seed
- `prisma/schema.prisma`
  - thêm enum: `GoalPeriodType`, `AiSuggestionStatus`, `AiScoreColor`.
  - thêm model: `KpiTarget`, `GoalSetting`, `AiSuggestion`, `AiSuggestionFeedback`.
  - thêm relation tương ứng vào `User`, `Branch`.
- migration mới `prisma/migrations/<timestamp>_ai_kpi_coach/`.
- `prisma/seed.ts`
  - seed `KpiTarget` mặc định theo branch/role.
  - seed `GoalSetting` (DAILY + MONTHLY hiện tại).
  - seed `AiSuggestion` mẫu + ít feedback.

### 2) API + service layer + RBAC
- Tạo service mới `src/lib/services/ai-kpi-coach.ts` để gom validate/scope logic.
- Tạo route mới:
  - `GET/POST /api/kpi/targets`
  - `GET/POST /api/goals`
  - `GET /api/ai/suggestions`
  - `POST /api/ai/suggestions/ingest` (service-token + idempotency)
  - `POST /api/ai/suggestions/[id]/feedback`
  - `POST /api/outbound/jobs` (safe endpoint từ UI action, có idempotency)
- Cập nhật RBAC:
  - `src/lib/permission-keys.ts` + `prisma` enum `PermissionModule` thêm module mới (AI coach/goals/targets) hoặc map vào module hiện có nếu tối giản.
  - `src/lib/permissions.ts` cập nhật default role permissions.
  - `src/lib/route-permissions-map.ts` map đầy đủ route mới.
- Cập nhật `src/lib/ui-permissions.ts` để guard route UI mới.

### 3) UI (full tiếng Việt, mobile-first)
- Thêm menu item tại `src/lib/admin-menu.ts`: `Trợ lý công việc`, `Mục tiêu KPI`, `Mục tiêu doanh thu`.
- Thêm page:
  - `src/app/(app)/ai/kpi-coach/page.tsx`
  - `src/app/(app)/kpi/targets/page.tsx`
  - `src/app/(app)/goals/page.tsx`
- Cập nhật dashboard `src/app/(app)/dashboard/page.tsx`:
  - widget “AI gợi ý hôm nay” (top 1-2) link sang `/ai/kpi-coach`.
- UI cards màu `Đỏ/Vàng/Xanh`, action tạo outbound và feedback 👍/👎.

### 4) Docs + API Hub + guide
- Tạo `N8N_WORKFLOWS_BLUEPRINT.md` với 3 workflow theo spec.
- Cập nhật `API_INTEGRATION_SPEC.md` với endpoints mới, idempotency/retry/backoff/token rotation.
- Cập nhật `src/lib/api-catalog.ts` + `src/app/(app)/api-hub/page.tsx` hiển thị ví dụ curl mới.
- Cập nhật `FEATURE_MAP_AND_RUNBOOK.md` + ghi `ADMIN_GUIDE_UPDATE_NOTES.md`.
- Tạo `TEST_CHECKLIST_AI_KPI_COACH.md` và `CHANGELOG_AI_KPI_COACH.md`.

## Rủi ro chính và cách giảm thiểu
- Mismatch enum/module giữa Prisma và app RBAC -> migrate + cập nhật map/module keys đồng bộ một lần.
- Scope rò dữ liệu (owner/branch) ở suggestions/goals -> tái dùng `resolveScope/getAllowedBranchIds/enforceBranchScope`.
- Tạo outbound từ AI action gây duplicate -> bắt buộc `Idempotency-Key` ở `/api/outbound/jobs`.
- UI nặng mobile -> dùng `MobileShell`, cards gọn, tránh fetch loop; guard theo pattern hiện tại.

## Verify dự kiến
- `npm run lint`
- `npm run build`
- `npm run verify`
- `npx prisma migrate reset --force`
- `npx prisma db seed`
- smoke API: ingest có token pass / không token fail; goals/targets upsert pass; ai coach page load không spinner vô hạn.
