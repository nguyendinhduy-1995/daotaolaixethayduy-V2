# CHANGELOG_EXPENSES

## 1) Mục tiêu
- Triển khai module Chi phí vận hành gồm: chi phí ngày, tổng hợp tháng, drilldown lương cơ bản theo chi nhánh/tháng.
- Bảo đảm deny-by-default RBAC và scope dữ liệu ở backend.

## 2) Files added
- `prisma/migrations/20260216073632_expenses_module/migration.sql`
- `prisma/migrations/20260216210000_permission_enum_expenses_finalize/migration.sql`
- `src/lib/services/expenses.ts`
- `src/app/api/expenses/daily/route.ts`
- `src/app/api/expenses/summary/route.ts`
- `src/app/api/expenses/base-salary/route.ts`
- `src/app/api/insights/expenses/route.ts`
- `src/app/api/insights/expenses/ingest/route.ts`
- `src/app/(app)/expenses/page.tsx`
- `src/app/(app)/expenses/daily/page.tsx`
- `src/app/(app)/expenses/monthly/page.tsx`

## 3) Files modified
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/lib/permission-keys.ts`
- `src/lib/permissions.ts`
- `src/lib/route-permissions-map.ts`
- `src/lib/ui-permissions.ts`
- `src/lib/admin-menu.ts`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `API_INTEGRATION_SPEC.md`
- `PERMISSION_MATRIX.md`
- `RUNBOOK_LOCAL.md`
- `REVIEW_PACKET.md`

## 4) Thay đổi chính
- Prisma thêm 4 model:
  - `ExpenseCategory`
  - `BranchExpenseDaily`
  - `BranchBaseSalary`
  - `ExpenseInsight`
- RBAC thêm module/action:
  - Module: `expenses`, `salary`, `insights`
  - Action: `EDIT`, `INGEST`
- API mới:
  - `GET/POST /api/expenses/daily`
  - `GET /api/expenses/summary`
  - `GET/POST /api/expenses/base-salary`
  - `GET /api/insights/expenses`
  - `POST /api/insights/expenses/ingest` (service token)
- UI mới:
  - `/expenses/daily`: nhập chi phí theo ngày và category.
  - `/expenses/monthly`: tổng hợp tháng, breakdown category, drilldown lương cơ bản.
  - Dashboard bổ sung widget tổng chi phí tháng.

## 5) Fix migration quan trọng
- Nguyên nhân lỗi reset trước đó: migration `expenses_module` có câu lệnh `ALTER TYPE PermissionAction/PermissionModule` chạy trước migration tạo enum RBAC.
- Đã fix:
  - Guard enum alter trong migration `20260216073632_expenses_module` để không fail khi enum chưa tồn tại.
  - Thêm migration `20260216210000_permission_enum_expenses_finalize` để bảo đảm enum values tồn tại sau khi RBAC tạo enum.

## 6) Kết quả verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `docker compose up -d postgres`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma migrate deploy`: PASS
- `npx prisma generate`: PASS
- `npx prisma db seed`: PASS

## 7) TODO nhỏ
- Bổ sung dashboard chart chi phí theo tuần/tháng cho mobile (hiện mới card tổng hợp + insight text).
- Bổ sung API idempotency middleware dùng chung cho các POST nghiệp vụ.
