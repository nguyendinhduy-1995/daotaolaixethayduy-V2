# CHANGELOG_LOGIC

## Summary
- Chuẩn hóa dữ liệu `Lịch học` từ metadata trong `rule` sang cột chuẩn trong `CourseScheduleItem`.
- Mở rộng validate trùng giờ khi tạo lịch thủ công: theo `course` và thêm theo `student` (khi tạo bằng `studentId`).
- Thêm cơ chế `allowOverlap=true` cho admin ở API (không thay đổi UI).
- Chuẩn hóa thông điệp lỗi tiếng Việt cho các route trọng điểm: leads/users/receipts/schedule.

## Migration
- Prisma schema cập nhật tại `prisma/schema.prisma`:
  - `enum ScheduleSource { AUTO, MANUAL }`
  - `enum ScheduleManualStatus { PLANNED, DONE, CANCELLED }`
  - `CourseScheduleItem`: thêm cột `source`, `status`, `location`, `note`.
- Migration SQL: `prisma/migrations/20260216105814_schedule_manual_fields/migration.sql`
  - Tạo enum DB.
  - Thêm cột mới.
  - Backfill dữ liệu cũ từ `rule.location/rule.note/rule.status/rule.manual|rule.source`.

## Backward compatibility
- API đọc lịch vẫn giữ tương thích dữ liệu cũ:
  - Nếu record cũ chưa có dữ liệu chuẩn, vẫn fallback từ `rule` khi trả `meta`.
- API ghi lịch mới ghi đồng thời:
  - Cột chuẩn (`source/status/location/note`) là nguồn chính.
  - `rule` vẫn giữ metadata để không phá luồng cũ.

## Files modified
- `prisma/schema.prisma`
- `prisma/migrations/20260216105814_schedule_manual_fields/migration.sql`
- `src/lib/services/schedule.ts`
- `src/lib/api-error-vi.ts`
- `src/app/api/schedule/route.ts`
- `src/app/api/schedule/[id]/route.ts`
- `src/app/api/schedule/[id]/attendance/route.ts`
- `src/app/(app)/schedule/page.tsx`
- `src/app/api/courses/[id]/schedule/route.ts`
- `src/app/(app)/courses/[id]/page.tsx`
- `src/app/api/leads/route.ts`
- `src/app/api/leads/[id]/route.ts`
- `src/app/api/leads/[id]/events/route.ts`
- `src/app/api/leads/assign/route.ts`
- `src/app/api/leads/auto-assign/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/receipts/route.ts`
- `src/app/api/receipts/[id]/route.ts`
- `src/app/api/receipts/summary/route.ts`

## Logic changes detail
- `POST /api/schedule` (`src/app/api/schedule/route.ts`):
  - Nhận `courseId` hoặc `studentId`.
  - Validate bắt buộc + status chuẩn hóa (`planned/done/cancelled` -> `PLANNED/DONE/CANCELLED`).
  - Check overlap theo course trong ngày (Asia/Ho_Chi_Minh).
  - Nếu tạo theo `studentId`, check overlap thêm theo student scope.
  - Nếu admin gửi `allowOverlap=true`, cho phép bỏ qua conflict.
  - Ghi `AttendanceAudit` action `CREATE_SCHEDULE`.
- `PATCH /api/schedule/[id]`:
  - Cập nhật song song cột chuẩn và `rule` cho tương thích ngược.
- UI `Lịch học`:
  - Vẫn giữ form nhập tay, map hiển thị trạng thái từ cả lowercase/UPPERCASE.

## API error message chuẩn hóa (VN)
- Helper mới: `src/lib/api-error-vi.ts`.
- Áp dụng message chuẩn cho nhóm route leads/users/receipts/schedule, giữ nguyên error code hiện có.
- Các cụm chuẩn:
  - `Không tìm thấy khách hàng`
  - `Không tìm thấy học viên`
  - `Thiếu dữ liệu bắt buộc`
  - `Trùng lịch trong khung giờ này`
  - `Bạn không có quyền thực hiện`
  - `Lỗi hệ thống`

## Verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npx playwright test`: PASS (2 tests)

## Bổ sung: API Hub + Business Flow docs
- Tạo tài liệu nghiệp vụ đầy đủ admin tại `ADMIN_BUSINESS_FLOW.md` (100% tiếng Việt, đủ module, có luồng liên thông P0).
- Tạo catalog API thực tế tại `src/lib/api-catalog.ts` (chỉ dùng route có trong `src/app/api/**/route.ts`).
- Tạo trang tra cứu tích hợp `src/app/(app)/api-hub/page.tsx`:
  - Lọc nhanh theo từ khóa.
  - Hiển thị method/path/auth/params/body/response/curl.
  - Có nút sao chép và cảnh báo token `REDACTED`.

## Bổ sung: RBAC nhóm quyền + override người dùng
- Mục tiêu:
  - Không phá role cũ (`admin/manager/telesales/direct_page/viewer`).
  - Thêm lớp quyền module/action có thể gán theo nhóm và ghi đè theo user.
- Prisma:
  - Thêm `PermissionModule`, `PermissionAction`.
  - Thêm `PermissionGroup`, `PermissionRule`, `UserPermissionOverride`.
  - Thêm `User.groupId` (nullable) + quan hệ liên quan.
  - Migration: `prisma/migrations/20260216133000_rbac_permissions/migration.sql`.
- Single source quyền:
  - `src/lib/permissions.ts`: enum module/action, quyền mặc định, merge rule.
  - Thứ tự merge: default role -> group rules -> user overrides.
  - Helper: `hasPermission`, `requirePermission`, `getEffectivePermissions`.
- Map route quyền:
  - `src/lib/route-permissions-map.ts` định nghĩa route nhạy cảm -> module/action.
  - `src/lib/route-auth.ts` bổ sung `requirePermissionRouteAuth`.
- API quản trị RBAC:
  - `GET/POST /api/admin/permission-groups`
  - `GET/PATCH/DELETE /api/admin/permission-groups/[id]`
  - `GET/PUT /api/admin/permission-groups/[id]/rules` (bulk upsert idempotent)
  - `GET/PUT /api/admin/users/[id]/permission-overrides` (bulk upsert idempotent + gán groupId)
- Enforcement API:
  - Áp dụng cho users/receipts/schedule/leads assign/payroll/automation và route liên quan.
  - Lỗi thiếu quyền trả `403 AUTH_FORBIDDEN` + message tiếng Việt.
- UI:
  - Trang mới `src/app/(app)/admin/phan-quyen/page.tsx`.
  - Menu desktop/mobile lọc theo quyền `VIEW`.
  - Ẩn nút tạo/chạy tay ở một số màn hình khi thiếu quyền (`leads`, `receipts`, `automation/run`).

## Bổ sung: RBAC hardening + scope enforcement
- Deny-by-default cho toàn bộ `/api/**` tại `middleware.ts`:
  - Route không thuộc allowlist public/secret và không có mapping quyền => `403 AUTH_FORBIDDEN`.
- Chuẩn hóa allowlist tại `src/lib/route-permissions-map.ts`:
  - `PUBLIC_API_ROUTES` cho login/logout/refresh/me/health/student-auth/templates.
  - `SECRET_AUTH_ROUTES` cho callback/ingest/cron/worker theo secret header.
- Nâng cấp audit coverage tại `scripts/audit-route-permissions.ts`:
  - Mọi route method trong `src/app/api/**/route.ts` phải có mapping hoặc nằm allowlist.
  - Route đã mapping bắt buộc gọi `requireMappedRoutePermissionAuth` hoặc `requirePermissionRouteAuth`.
- Chuẩn hóa enforcement ở các route mapped:
  - Đã thay các route còn dùng helper auth cũ sang helper RBAC mapped-permission (chi tiết file ở `PATCH_NOTES.md`).
- Scope enforcement:
  - Tiếp tục dùng `src/lib/scope.ts` cho `SYSTEM/BRANCH/OWNER`.
  - Áp dụng cho luồng dữ liệu chính: leads/students/receipts/schedule/outbound messages/payroll.

### Verify (đợt hardening này)
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run audit:permissions`: PASS
- `npx playwright test tests/rbac-permissions.spec.ts`: FAIL
  - Nguyên nhân môi trường: webServer Playwright không khởi động ổn định (`listen EPERM 0.0.0.0:3000` / treo startup).
