# CHANGELOG_KPI_PERCENT_ONLY

## 1) Mục tiêu thay đổi
- Chuẩn hóa KPI theo phần trăm (%) theo nghiệp vụ mới.
- Định nghĩa lại KPI Trực Page/Tư vấn theo numerator/denominator chuẩn.
- Đổi tên và Việt hóa UI `Trợ lý KPI (AI)` thành `Trợ lý công việc`.
- Bổ sung target KPI theo nhân sự (override) với validation vai trò-chỉ số.

## 2) File thay đổi chính
- KPI service/API:
  - `src/lib/services/kpi-daily.ts`
  - `src/app/api/kpi/daily/route.ts`
  - `src/lib/services/ai-kpi-coach.ts`
  - `src/app/api/kpi/targets/route.ts`
- KPI catalog/UI:
  - `src/lib/kpi-metrics-catalog.ts`
  - `src/app/(app)/kpi/daily/page.tsx`
  - `src/app/(app)/kpi/targets/page.tsx`
  - `src/app/(app)/ai/kpi-coach/page.tsx`
  - `src/app/(app)/dashboard/page.tsx`
  - `src/lib/admin-menu.ts`
  - `src/app/(app)/layout.tsx`
  - `src/app/(app)/api-hub/page.tsx`
- Seed/docs/tests:
  - `prisma/seed.ts`
  - `src/lib/api-catalog.ts`
  - `API_INTEGRATION_SPEC.md`
  - `N8N_WORKFLOWS_BLUEPRINT.md`
  - `TEST_CHECKLIST_AI_KPI_COACH.md`
  - `CHANGELOG_AI_KPI_COACH.md`
  - `tests/ai-kpi-coach.spec.ts`

## 3) Before/After ngắn gọn
- Before:
  - KPI ngày trộn số lượng + tài chính.
  - KPI target có key số lượng cũ (`called_daily`, `has_phone_daily`...).
  - UI còn cụm `Trợ lý KPI (AI)`, `Telesales`, `Tạo Outbound`, và text kỹ thuật.
- After:
  - KPI ngày chỉ còn KPI phần trăm:
    - Trực Page: `Tỉ lệ lấy được số`.
    - Tư vấn: `Tỉ lệ hẹn từ data`, `Tỉ lệ đến từ hẹn`, `Tỉ lệ ký từ đến`.
  - KPI target chỉ nhận catalog KPI %, validate `0..100`.
  - Hỗ trợ target theo vai trò hoặc theo nhân sự (`ownerId`).
  - UI module AI đổi thành `Trợ lý công việc`, text đời thường, không lộ enum.

## 4) Manual test bắt buộc
- [ ] `/kpi/daily` hiển thị KPI dạng `%` (ngày + lũy kế tháng), không còn card KPI số lượng cũ.
- [ ] `/kpi/targets` chỉ cho chọn chỉ số KPI %, nhập mục tiêu `0..100`.
- [ ] `/ai/kpi-coach` hiển thị nhãn `Trợ lý công việc`, button `Tạo danh sách gọi`, phản hồi `Đúng, hữu ích` / `Chưa đúng`.
- [ ] Gửi metric sai vai trò qua `POST /api/kpi/targets` nhận `400` + message tiếng Việt.

## 5) Verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma db seed`: PASS
