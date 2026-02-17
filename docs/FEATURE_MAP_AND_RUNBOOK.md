# FEATURE_MAP_AND_RUNBOOK

## 1) Sơ đồ module Admin
- Tổng quan: `src/app/(app)/dashboard/page.tsx`
- Khách hàng: `src/app/(app)/leads/page.tsx`, `src/app/(app)/leads/board/page.tsx`
- KPI ngày: `src/app/(app)/kpi/daily/page.tsx`
- Mục tiêu KPI: `src/app/(app)/kpi/targets/page.tsx`
- Mục tiêu ngày/tháng: `src/app/(app)/goals/page.tsx`
- Trợ lý công việc: `src/app/(app)/ai/kpi-coach/page.tsx`
- Thu tiền: `src/app/(app)/receipts/page.tsx`
- Payroll/Commission: `src/app/(app)/hr/payroll/page.tsx`, `src/app/api/admin/commissions/route.ts`
- Học viên/Khóa học/Lịch học: `src/app/(app)/students/page.tsx`, `src/app/(app)/courses/page.tsx`, `src/app/(app)/schedule/page.tsx`
- Automation/Outbound: `src/app/(app)/automation/run/page.tsx`, `src/app/(app)/outbound/page.tsx`
- Chi phí: `src/app/(app)/expenses/monthly/page.tsx`, `src/app/(app)/expenses/daily/page.tsx`
- API Hub: `src/app/(app)/api-hub/page.tsx`
- Hướng dẫn vận hành: `src/app/(app)/admin/guide/page.tsx`

## 2) Nghiệp vụ cốt lõi theo module
### Tổng quan
- Input: dữ liệu leads, receipts, payroll, expenses theo scope.
- Flow: UI dashboard -> API tổng hợp -> service -> Prisma.
- Output: card KPI theo ngày/tháng.

### Khách hàng
- Input: lead mới, cập nhật trạng thái, phân công owner.
- Flow: `/leads` -> `/api/leads*` -> `Lead`, `LeadEvent`, `LeadMessage`.
- Output: pipeline NEW -> HAS_PHONE -> CALLED/APPOINTED...

### KPI ngày
- Input: range ngày và owner.
- Flow: `/kpi/daily` -> `/api/kpi/daily` -> thống kê theo event/receipt.
- Output: chỉ số daily team/owner.

### Mục tiêu KPI
- Input: role + metric + target theo branch/dayOfWeek.
- Flow: `/kpi/targets` -> `/api/kpi/targets` -> `KpiTarget`.
- Output: chuẩn target để n8n/AI so sánh gap theo vai trò.

### Mục tiêu ngày/tháng
- Input: doanh thu, số hồ sơ, chi phí theo kỳ DAILY/MONTHLY.
- Flow: `/goals` -> `/api/goals` -> `GoalSetting`.
- Output: goal baseline cho báo cáo giám đốc và AI briefing.

### Trợ lý công việc
- Input: suggestions ingest từ n8n + feedback từ user.
- Flow:
  - n8n -> `/api/ai/suggestions/ingest` -> `AiSuggestion`
  - UI `/ai/kpi-coach` -> `/api/ai/suggestions` + `/api/ai/suggestions/{id}/feedback`
  - action outbound -> `/api/outbound/jobs`
- Output: gợi ý hành động + vòng lặp học từ feedback.

### Thu tiền
- Input: phiếu thu theo học viên.
- Flow: `/receipts` -> `/api/receipts` -> `Receipt`.
- Output: doanh thu theo ngày/kỳ.

### Payroll/Commission
- Input: attendance, salary profile, commission.
- Flow: HR pages -> `/api/admin/payroll*`, `/api/admin/commissions*`.
- Output: bảng lương, chi tiết khoản thu nhập.

### Học viên/Khóa học/Lịch học
- Input: tạo học viên từ lead, gán khóa học, tạo lịch học thủ công.
- Flow: `/students`, `/courses`, `/schedule` -> API tương ứng -> `Student`, `Course`, `CourseScheduleItem`.
- Output: tiến độ học tập và lịch học.

### Automation/Outbound
- Input: templates, job run, queue dispatch.
- Flow: `/automation/run`, `/outbound` -> `/api/outbound/messages`, `/api/outbound/dispatch`.
- Output: trạng thái QUEUED/SENT/FAILED/SKIPPED và log.

### Chi phí
- Input: chi phí theo ngày theo danh mục + lương cơ bản theo tháng.
- Flow:
  - `/expenses/daily` -> `/api/expenses/daily`
  - `/expenses/monthly` -> `/api/expenses/summary` + `/api/expenses/base-salary`
  - insight ingest -> `/api/insights/expenses/ingest`
- Output: tổng chi phí tháng = chi phí vận hành + lương cơ bản.

### API Hub
- Input: catalog API thật trong codebase.
- Flow: `/api-hub` đọc từ `src/lib/api-catalog.ts`.
- Output: tài liệu contract/curl tích hợp.

## 3) RBAC theo vai trò + branch scope
- Vai trò enum hiện có: `admin`, `manager`, `telesales`, `direct_page`, `viewer`.
- Map nghiệp vụ dùng trong vận hành:
  - Admin/Director -> `admin` (toàn hệ thống).
  - Manager/Accountant -> `manager` (theo chi nhánh).
  - Telesales -> `telesales`, `direct_page` (owner scope).
- Rule scope:
  - `admin`: SYSTEM, xem tất cả chi nhánh.
  - `manager`: BRANCH, chỉ `branchId` của user.
  - `telesales/direct_page`: OWNER, dữ liệu do owner phụ trách.
- Utility dùng chung: `src/lib/scope.ts`
  - `getAllowedBranchIds(user)`
  - `enforceBranchScope(branchId, user)`
  - `whereBranchScope(user, extraWhere)`
  - `resolveScope` + `applyScopeToWhere`

## 4) API contract tóm tắt (chính)
- Auth:
  - `POST /api/auth/login` (email hoặc username)
  - `GET /api/auth/me`
  - `POST /api/auth/refresh`
- Leads:
  - `GET/POST /api/leads`
  - `PATCH /api/leads/[id]`
- Students/Courses/Schedule:
  - `GET/POST /api/students`
  - `GET/POST /api/courses`
  - `GET/POST /api/schedule`
- Receipts:
  - `GET/POST /api/receipts`
  - `GET /api/receipts/summary`
- Expenses:
  - `GET/POST /api/expenses/daily`
  - `GET /api/expenses/summary`
  - `GET/POST /api/expenses/base-salary`
  - `GET /api/insights/expenses`
  - `POST /api/insights/expenses/ingest` (service token)
- Trợ lý công việc:
  - `GET/POST /api/kpi/targets`
  - `GET/POST /api/goals`
  - `GET /api/ai/suggestions`
  - `POST /api/ai/suggestions/ingest` (service token + idempotency)
  - `POST /api/ai/suggestions/{id}/feedback`
  - `POST /api/outbound/jobs` (idempotency)

## 5) Checklist vận hành hằng ngày theo vai trò
### Admin/Director
- Kiểm tra dashboard và KPI ngày.
- Duyệt danh sách phiếu thu bất thường.
- Kiểm tra queue outbound và automation logs.
- Kiểm tra tổng chi phí tháng + insight tăng giảm.

### Manager/Accountant
- Đối soát thu tiền theo chi nhánh.
- Nhập/điều chỉnh chi phí ngày.
- Cập nhật lương cơ bản theo tháng.
- Theo dõi chấm công và chuẩn bị payroll.
- Chỉnh mục tiêu KPI/goal theo chi nhánh.
- Duyệt và phản hồi gợi ý AI trong ngày.

### Telesales/Direct Page
- Cập nhật trạng thái khách hàng đúng pipeline.
- Tạo lịch học thủ công khi cần.
- Theo dõi thông báo và outbound follow-up.
- Mở `Trợ lý công việc` để nhận gợi ý và tạo danh sách gọi nhanh.

## 6) Seed + test local
- Chuẩn bị:
  - `docker compose up -d`
  - `npx prisma migrate reset --force`
  - `npx prisma db seed`
- Chạy app:
  - `npm run dev`
  - fallback ổn định: `npm run dev:stable`
- Verify:
  - `npm run lint`
  - `npm run build`
  - `npm run verify`
  - `npm run test:e2e:local` (best-effort theo môi trường local)

## 7) Xử lý lỗi cache/Turbopack
- Nếu dev bị treo hoặc lock:
  - `pkill -f "next dev"`
  - `rm -f .next/dev/lock`
  - chạy lại `npm run dev:stable`
- Nếu lỗi migrate/seed:
  - kiểm tra `DATABASE_URL`
  - chạy lại `npx prisma migrate reset --force` rồi `npx prisma db seed`

## 8) Ghi chú bảo mật vận hành
- Không dán token thật vào API Hub.
- Route secret ingest không public:
  - `/api/insights/expenses/ingest` yêu cầu `x-service-token`.
- POST tạo quan trọng phải có `Idempotency-Key`:
  - `/api/receipts`
  - `/api/schedule`
  - `/api/outbound/dispatch`
  - `/api/insights/expenses/ingest`

## 9) Cập nhật service token ingest
- Mục tiêu: đổi token `x-service-token` an toàn theo biến `SERVICE_TOKEN`.
1. Tạo token mới và cập nhật `SERVICE_TOKEN` trên ứng dụng.
2. Deploy ứng dụng.
3. Cập nhật credential ở n8n sang token mới ngay sau deploy.
4. Xác nhận ingest chạy ổn với `source=n8n` + `runId`.
- Lưu ý:
  - Theo dõi log ingest và `ExpenseInsight.runId`.
  - Không gửi token thật trong curl/docs nội bộ.
