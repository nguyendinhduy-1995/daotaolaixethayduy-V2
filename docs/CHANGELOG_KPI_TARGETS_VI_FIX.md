# CHANGELOG_KPI_TARGETS_VI_FIX

## 1) Mục tiêu fix
- Chuẩn hóa tiếng Việt cho module KPI AI (không lộ enum/raw key trên UI).
- Sửa nghiệp vụ `Mục tiêu KPI`:
  - không nhập chỉ số tự do,
  - validate chỉ số theo vai trò,
  - hỗ trợ target theo nhân sự (`ownerId`) và theo vai trò.

## 2) Files thay đổi chính
- Data model:
  - `prisma/schema.prisma`
  - `prisma/migrations/20260217003000_kpi_target_owner_override/migration.sql`
- KPI catalog:
  - `src/lib/kpi-metrics-catalog.ts`
- API/service:
  - `src/lib/services/ai-kpi-coach.ts`
  - `src/app/api/kpi/targets/route.ts`
- UI:
  - `src/app/(app)/kpi/targets/page.tsx`
  - `src/app/(app)/ai/kpi-coach/page.tsx`
- Seed:
  - `prisma/seed.ts`
- Docs:
  - `src/lib/api-catalog.ts`
  - `N8N_WORKFLOWS_BLUEPRINT.md`
  - `TEST_CHECKLIST_AI_KPI_COACH.md`
  - `CHANGELOG_AI_KPI_COACH.md`

## 3) Before/After
- Before:
  - nhập `metricKey` text tự do,
  - dễ tạo sai role-metric,
  - chưa có target override theo nhân sự,
  - UI còn hiển thị enum raw.
- After:
  - chỉ số chọn từ catalog tiếng Việt,
  - API chặn metric sai vai trò (400 tiếng Việt),
  - thêm `ownerId` cho target theo nhân sự,
  - UI render label tiếng Việt (vai trò/chỉ số/màu).

## 4) Verify steps
- `npm run lint`
- `npm run build`
- `npm run verify`
- `npx prisma migrate reset --force`
- `npx prisma db seed`

## 5) Kết quả verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma db seed`: PASS
