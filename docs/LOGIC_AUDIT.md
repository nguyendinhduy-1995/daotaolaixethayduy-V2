# LOGIC_AUDIT

## 1) Phạm vi quét
- UI routes: `src/app/(app)/**/page.tsx`.
- API routes: `src/app/api/**/route.ts`.
- Prisma models: `prisma/schema.prisma` (Lead/Student/Course/CourseScheduleItem/Receipt/Automation/HR).

## 2) Inventory & nhận xét theo module

### Users
- UI: `src/app/(app)/admin/users/page.tsx`.
- API: `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`, alias admin ở `src/app/api/admin/users/*`.
- CRUD: đủ Create/Read/Update; chưa có delete mềm chuẩn.
- Permission/validate: có admin guard + validate role/branch/password.

### Khách hàng (Leads)
- UI: `src/app/(app)/leads/page.tsx`, `src/app/(app)/leads/board/page.tsx`, `src/app/(app)/leads/[id]/page.tsx`.
- API: `src/app/api/leads/*`, `src/app/api/leads/assign/route.ts`, `src/app/api/leads/auto-assign/route.ts`.
- CRUD: đủ Create/Read/Update; không có delete (hợp lý để giữ lịch sử).
- Permission/validate: có scope theo owner cho telesales; có log LeadEvent.

### KPI / Dashboard
- UI: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/kpi/daily/page.tsx`.
- API: `src/app/api/kpi/daily/route.ts`, service `src/lib/services/kpi-daily.ts`.
- Nhận xét: đúng luồng read-only, timezone HCM theo service.

### Phiếu thu
- UI: `src/app/(app)/receipts/page.tsx`.
- API: `src/app/api/receipts/route.ts`, `src/app/api/receipts/[id]/route.ts`, `src/app/api/receipts/summary/route.ts`.
- CRUD: có Create/Read/Update, không delete.
- Permission/validate: scope theo owner cho non-admin; parse amount/method/date.

### Payroll / Commission / HR
- UI: `src/app/(app)/hr/*`, `src/app/(app)/me/payroll/page.tsx`.
- API: `src/app/api/admin/payroll/*`, `src/app/api/admin/commissions/*`, `src/app/api/admin/attendance/*`, `src/app/api/admin/employee-kpi/*`.
- Nhận xét: luồng chính đầy đủ; còn rủi ro lock khi chạy generate đồng thời.

### Học viên / Khóa học / Lịch học
- UI: `src/app/(app)/students/*`, `src/app/(app)/courses/*`, `src/app/(app)/schedule/*`.
- API: `src/app/api/students/*`, `src/app/api/courses/*`, `src/app/api/schedule/*`.
- Trạng thái sau fix:
  - Đã có tạo lịch thủ công từ trang `Lịch học`.
  - Đã chuẩn hóa dữ liệu lịch sang cột chuẩn (`source/status/location/note`).
  - Đã giữ fallback dữ liệu cũ từ `rule` khi đọc.

### Automation / Outbound / Ops / Marketing
- UI: `src/app/(app)/automation/*`, `src/app/(app)/outbound/page.tsx`, `src/app/(app)/admin/ops/page.tsx`, `src/app/(app)/marketing/page.tsx`.
- API: `src/app/api/automation/*`, `src/app/api/outbound/*`, `src/app/api/ops/pulse/route.ts`, `src/app/api/admin/ops/pulse/route.ts`, `src/app/api/marketing/*`.
- Nhận xét: coverage tốt cho vận hành; retry policy còn chủ yếu ở backend/worker.

## 3) Fix chính đã triển khai

### 3.1 Chuẩn hóa dữ liệu Lịch học
- Prisma cập nhật tại `prisma/schema.prisma`:
  - `ScheduleSource` + `ScheduleManualStatus`.
  - `CourseScheduleItem` thêm `source`, `status`, `location`, `note`.
- Migration: `prisma/migrations/20260216105814_schedule_manual_fields/migration.sql`.
- Backfill từ dữ liệu cũ trong `rule` để tránh mất dữ liệu.

### 3.2 API tạo lịch thủ công
- File: `src/app/api/schedule/route.ts` (`POST /api/schedule`).
- Nghiệp vụ:
  - Tạo theo `courseId` hoặc `studentId`.
  - Validate dữ liệu bắt buộc và thời gian.
  - Resolve `courseId` từ `studentId`.
  - Check trùng giờ theo course.
  - Nếu tạo theo student: check thêm trùng giờ theo student scope.
  - Hỗ trợ `allowOverlap=true` cho admin.
  - Ghi `AttendanceAudit`.

### 3.3 UI thao tác Lịch học
- File: `src/app/(app)/schedule/page.tsx`.
- Đã có nút `Thêm lịch học`, dialog nhập tay, submit API, refresh danh sách.
- Cột hiển thị trạng thái học đã hỗ trợ cả lowercase/UPPERCASE.

### 3.4 Việt hóa API errors (không đổi error code)
- Helper: `src/lib/api-error-vi.ts`.
- Áp dụng cho routes nhóm leads/users/receipts/schedule.

## 4) Điểm còn thiếu sau audit
- Chưa có policy delete mềm đồng nhất toàn hệ thống.
- Một số route ngoài nhóm ưu tiên vẫn còn message tiếng Anh rải rác (nếu muốn full VN toàn backend, cần quét tiếp toàn bộ `src/app/api/**`).
- `courses/[id]/schedule` chưa có check overlap sâu như `/api/schedule` (đã chuẩn hóa cột nhưng chưa mở rộng logic conflict tương đương).

## 5) Verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npx playwright test`: PASS (2 passed)
