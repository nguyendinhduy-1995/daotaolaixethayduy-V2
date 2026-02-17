# CHANGELOG_HARDENING_PASS

## 1) Tổng quan
- Hoàn tất hardening P0 theo 4 trục: identity/login, branch-scope, idempotency, ingest security.
- Không thêm nghiệp vụ mới ngoài phạm vi chuẩn hóa vận hành/RBAC/data-safety.

## 2) Thay đổi chính theo nhóm
### Identity/Login
- Thêm `User.username` (unique, not null) và bỏ login theo `User.name`.
- `POST /api/auth/login` chấp nhận `email OR username`.
- UI login đổi label: `Tài khoản (username hoặc email)`.
- `GET /api/auth/me` trả thêm `username`.

### Branch scope
- Thêm `branchId` (nullable, indexed) cho các entity chính:
  - `Lead`, `Student`, `Receipt`, `CourseScheduleItem`, `AutomationLog`, `OutboundMessage`.
- Bổ sung utility scope dùng chung tại `src/lib/scope.ts`:
  - `getAllowedBranchIds`
  - `enforceBranchScope`
  - `whereBranchScope`
- Refactor create-flow để lưu `branchId` khi tạo bản ghi mới (leads/students/receipts/schedule/outbound).

### Idempotency
- Thêm bảng `IdempotencyRequest`.
- Thêm helper `src/lib/idempotency.ts`.
- Enforce `Idempotency-Key` cho POST quan trọng:
  - `POST /api/receipts`
  - `POST /api/schedule`
  - `POST /api/outbound/dispatch`
  - `POST /api/insights/expenses/ingest`

### Ingest hardening
- `POST /api/insights/expenses/ingest`:
  - xác thực `x-service-token` theo `SERVICE_TOKEN_ACTIVE` hoặc `SERVICE_TOKEN_NEXT` (fallback legacy `INSIGHTS_SERVICE_TOKEN`).
  - bắt buộc payload có `source='n8n'` và `runId`.
  - lưu audit fields `runId`, `payloadHash` vào `ExpenseInsight`.
  - rate limit in-memory nhẹ.

### Admin Guide Page
- Thêm route `/admin/guide`.
- Đọc nội dung từ `FEATURE_MAP_AND_RUNBOOK.md`.
- UI có search, mục lục, section collapsible.
- Hiển thị nhãn quyền theo module (`Có quyền truy cập` / `Không có quyền truy cập`).

## 3) Files thay đổi trọng yếu
- `prisma/schema.prisma`
- `prisma/migrations/20260216223000_hardening_identity_scope_idempotency/migration.sql`
- `src/app/api/auth/login/route.ts`
- `src/app/login/page.tsx`
- `src/app/api/auth/me/route.ts`
- `src/lib/scope.ts`
- `src/lib/idempotency.ts`
- `src/app/api/receipts/route.ts`
- `src/app/api/schedule/route.ts`
- `src/app/api/outbound/dispatch/route.ts`
- `src/app/api/insights/expenses/ingest/route.ts`
- `src/lib/services/expenses.ts`
- `src/app/(app)/admin/guide/page.tsx`
- `src/components/admin/AdminGuideClient.tsx`
- `FEATURE_MAP_AND_RUNBOOK.md`

## 4) Seed/Auth mặc định
- Seed tạo admin username: `Nguyendinhduy`
- Password: `Nguyendinhduy@95`
- Email fallback: `admin@thayduy.local`

## 5) Verify
- Đã chạy và ghi kết quả trong `REVIEW_PACKET.md`.
