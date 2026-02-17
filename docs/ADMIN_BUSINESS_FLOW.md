# ADMIN_BUSINESS_FLOW

## Nguyên tắc tài liệu
- Ngôn ngữ hiển thị: tiếng Việt 100%.
- Mọi luồng đều ghi theo chuỗi: `UI -> API -> Service -> DB -> Log/Event`.
- Phạm vi route thực tế: `src/app/(app)/**/page.tsx` và `src/app/api/**/route.ts`.

## 1) Tổng quan
- Mục tiêu nghiệp vụ:
- Hiển thị nhanh tình hình vận hành trong ngày để admin chốt quyết định.
- Tổng hợp số liệu khách hàng, tài chính, automation và việc cần làm.
- Dữ liệu liên quan:
- Prisma: `Lead`, `LeadEvent`, `Receipt`, `Notification`, `AutomationLog` tại `prisma/schema.prisma`.
- Service: `src/lib/services/kpi-daily.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/dashboard/page.tsx`.
- API: `GET /api/kpi/daily`, `GET /api/receipts/summary`, `GET /api/automation/logs`, `GET /api/notifications`.
- Service: `getKpiDaily`.
- DB: đọc tổng hợp từ Lead/LeadEvent/Receipt.
- Event/log: không ghi mới ở màn hình tổng quan.
- Quy tắc/logic:
- Bắt buộc đăng nhập; dữ liệu bị giới hạn theo vai trò.
- KPI ngày dùng timezone Asia/Ho_Chi_Minh.
- Output/KPI ảnh hưởng:
- KPI ngày, số phiếu thu, số automation lỗi, số việc tồn.

## 2) Khách hàng
- Mục tiêu nghiệp vụ:
- Quản lý vòng đời khách hàng từ tạo mới tới chuyển trạng thái.
- Bảo đảm dữ liệu owner, trạng thái và lịch sử thao tác đầy đủ.
- Dữ liệu liên quan:
- Prisma: `Lead`, `LeadEvent`, enum `LeadStatus`, `LeadEventType`.
- Service/helper: `src/lib/lead-events.ts`, `src/lib/admin-auth.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/leads/page.tsx`, `src/app/(app)/leads/[id]/page.tsx`.
- API: `GET/POST /api/leads`, `GET/PATCH /api/leads/{id}`, `GET/POST /api/leads/{id}/events`.
- Service: log sự kiện trạng thái qua `logLeadEvent`.
- DB: ghi Lead + LeadEvent.
- Event/log: ghi LeadEvent khi đổi trạng thái/owner.
- Quy tắc/logic:
- Telesales chỉ thấy lead thuộc owner của mình.
- Admin mới được đổi owner trực tiếp.
- Validate status/tags/date/pagination.
- Output/KPI ảnh hưởng:
- Ảnh hưởng trực tiếp KPI ngày, pipeline, thông báo follow-up.

## 3) Bảng trạng thái
- Mục tiêu nghiệp vụ:
- Theo dõi pipeline dạng cột để kéo/thả và xử lý bottleneck.
- Dữ liệu liên quan:
- Prisma: `Lead`, `LeadEvent`.
- File UI: `src/app/(app)/leads/board/page.tsx`.
- Luồng thao tác:
- UI: thao tác đổi cột trạng thái.
- API: `PATCH /api/leads/{id}` hoặc `POST /api/leads/{id}/events`.
- Service: `logLeadEvent`.
- DB: cập nhật Lead + insert LeadEvent.
- Event/log: ghi OWNER_CHANGED hoặc event trạng thái.
- Quy tắc/logic:
- Chỉ role có quyền lead mới thao tác.
- Trạng thái phải thuộc enum hợp lệ.
- Output/KPI ảnh hưởng:
- Tỷ lệ chuyển đổi và các chỉ số gọi/hẹn/đến/ký.

## 4) KPI ngày
- Mục tiêu nghiệp vụ:
- Đo hiệu suất theo ngày và so sánh xu hướng.
- Dữ liệu liên quan:
- Prisma: `Lead`, `LeadEvent`, `Receipt`, `Student`.
- Service: `src/lib/services/kpi-daily.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/kpi/daily/page.tsx`.
- API: `GET /api/kpi/daily`.
- Service: tổng hợp KPI theo ngày.
- DB: aggregate theo khoảng ngày HCM.
- Event/log: không ghi mới.
- Quy tắc/logic:
- Validate date, default theo ngày hiện tại.
- Output/KPI ảnh hưởng:
- Bảng KPI telesales + tài chính trong ngày.

## 5) Học viên
- Mục tiêu nghiệp vụ:
- Chuyển khách đủ điều kiện thành học viên và theo dõi trạng thái học.
- Dữ liệu liên quan:
- Prisma: `Student`, `Lead`, enum `StudyStatus`.
- API files: `src/app/api/students/route.ts`, `src/app/api/students/[id]/route.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/students/page.tsx`, `src/app/(app)/students/[id]/page.tsx`.
- API: `GET/POST /api/students`, `GET/PATCH /api/students/{id}`.
- Service: quyền dựa owner lead.
- DB: tạo/cập nhật Student.
- Event/log: gián tiếp ảnh hưởng notification/automation.
- Quy tắc/logic:
- Non-admin chỉ thao tác học viên thuộc lead owner của mình.
- Validate studyStatus/exam fields.
- Output/KPI ảnh hưởng:
- Ảnh hưởng thu tiền, lịch học, KPI học vụ.

## 6) Khóa học
- Mục tiêu nghiệp vụ:
- Quản lý danh mục khóa học và thông tin đào tạo.
- Dữ liệu liên quan:
- Prisma: `Course`, `Student`, `CourseScheduleItem`.
- API files: `src/app/api/courses/route.ts`, `src/app/api/courses/[id]/route.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/courses/page.tsx`, `src/app/(app)/courses/[id]/page.tsx`.
- API: `GET/POST /api/courses`, `GET/PATCH /api/courses/{id}`.
- DB: ghi Course.
- Event/log: chưa có log chuyên biệt.
- Quy tắc/logic:
- Validate code/date/isActive.
- Output/KPI ảnh hưởng:
- Ảnh hưởng lịch học, danh sách học viên, báo cáo vận hành.

## 7) Lịch học
- Mục tiêu nghiệp vụ:
- Lập lịch học, điểm danh và giám sát buổi học theo thời gian thực.
- Dữ liệu liên quan:
- Prisma: `CourseScheduleItem`, `AttendanceSession`, `AttendanceRecord`, `AttendanceAudit`.
- Service: `src/lib/services/schedule.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/schedule/page.tsx`, `src/app/(app)/schedule/[id]/page.tsx`.
- API: `GET/POST /api/schedule`, `GET/PATCH /api/schedule/{id}`, `POST /api/schedule/{id}/attendance`.
- Service: scope theo role + tính `scheduleStatus`.
- DB: ghi schedule, attendance session/record/audit.
- Event/log: ghi `AttendanceAudit` (CREATE_SCHEDULE, UPDATE_SCHEDULE, UPSERT_ATTENDANCE).
- Quy tắc/logic:
- Dữ liệu chuẩn hóa cột: `source/status/location/note`.
- Tương thích ngược: record cũ đọc fallback từ `rule`.
- Check trùng giờ theo course; nếu tạo theo student thì check thêm theo student.
- Admin có thể override conflict qua `allowOverlap=true`.
- Output/KPI ảnh hưởng:
- Tỷ lệ đi học/điểm danh, tiến độ học viên, chất lượng vận hành lớp.

## 8) Thu tiền
- Mục tiêu nghiệp vụ:
- Ghi nhận dòng tiền từ học viên và theo dõi công nợ.
- Dữ liệu liên quan:
- Prisma: `Receipt`, `Student`, enum `ReceiptMethod`.
- API files: `src/app/api/receipts/route.ts`, `src/app/api/receipts/[id]/route.ts`, `src/app/api/receipts/summary/route.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/receipts/page.tsx`, `src/app/(app)/students/[id]/page.tsx`.
- API: `GET/POST/PATCH` receipt + summary.
- DB: ghi Receipt.
- Event/log: không có event riêng, ảnh hưởng KPI tài chính.
- Quy tắc/logic:
- Validate amount/method/date.
- Non-admin chỉ thấy receipt của lead thuộc owner.
- Output/KPI ảnh hưởng:
- Tổng thu, tổng phiếu thu, tổng lương/commission.

## 9) Thông báo
- Mục tiêu nghiệp vụ:
- Quản lý backlog việc cần làm theo scope (finance/followup/schedule/system).
- Dữ liệu liên quan:
- Prisma: `Notification`, `NotificationRule`.
- Service: `src/lib/services/notification-generate.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/notifications/page.tsx`.
- API: `GET /api/notifications`, `PATCH /api/notifications/{id}`, `POST /api/notifications/generate`.
- Service: generate candidate và dedupe.
- DB: ghi/cập nhật Notification.
- Event/log: outbound liên đới khi gửi tin.
- Quy tắc/logic:
- Validate status/priority/scope.
- Output/KPI ảnh hưởng:
- Giảm backlog NEW/DOING, tăng hiệu suất xử lý.

## 10) Gửi tin
- Mục tiêu nghiệp vụ:
- Điều phối tin nhắn chủ động tới khách hàng/học viên.
- Dữ liệu liên quan:
- Prisma: `OutboundMessage`, `MessageTemplate`, `AutomationLog`.
- Service: `src/lib/services/outbound-worker.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/outbound/page.tsx`.
- API: `GET/POST /api/outbound/messages`, `POST /api/outbound/dispatch`, `POST /api/outbound/callback`.
- Service: lease, dispatch, retry và rate limit.
- DB: ghi OutboundMessage + AutomationLog.
- Event/log: log sent/failed/skipped.
- Quy tắc/logic:
- Queue + retryCount + lease để tránh xử lý trùng.
- Output/KPI ảnh hưởng:
- Tỷ lệ gửi thành công, tỷ lệ thất bại, tốc độ xử lý queue.

## 11) Lương tôi
- Mục tiêu nghiệp vụ:
- Cho nhân sự xem phiếu lương minh bạch theo tháng.
- Dữ liệu liên quan:
- Prisma: `PayrollRun`, `PayrollItem`.
- API: `GET /api/me/payroll`.
- Luồng thao tác:
- UI: `src/app/(app)/me/payroll/page.tsx`.
- API -> DB: đọc payroll item theo user hiện tại.
- Quy tắc/logic:
- Không cho đọc lương người khác.
- Output/KPI ảnh hưởng:
- Minh bạch tổng thu nhập cá nhân.

## 12) VẬN HÀNH — AI hỗ trợ nhân sự
- Mục tiêu nghiệp vụ:
- Cung cấp snapshot cảnh báo + gợi ý hành động ưu tiên.
- Dữ liệu liên quan:
- Prisma: `OpsPulse`, `EmployeeKpiSetting`, `LeadEvent`.
- Service: `src/lib/services/ops-pulse.ts`.
- Luồng thao tác:
- UI: `src/app/(app)/admin/ops/page.tsx`.
- API: `GET /api/admin/ops/pulse`, `POST /api/ops/pulse`.
- Service: tính gap theo target.
- DB: ghi/đọc OpsPulse.
- Event/log: snapshot idempotent theo bucket.
- Quy tắc/logic:
- Chỉ admin xem toàn cục.
- Output/KPI ảnh hưởng:
- Tăng tốc phản ứng vận hành theo owner/role.

## 13) VẬN HÀNH — Luồng n8n
- Mục tiêu nghiệp vụ:
- Tập trung tài liệu workflow tích hợp n8n cho admin.
- Dữ liệu liên quan:
- Catalog/workflow docs: `src/lib/n8n-workflows.ts`, `docs/n8n/*`.
- API: `GET /api/admin/n8n/workflows`.
- Luồng thao tác:
- UI: `src/app/(app)/admin/n8n/page.tsx`.
- API -> service data -> trả docs JSON.
- Quy tắc/logic:
- Chỉ admin truy cập.
- Output/KPI ảnh hưởng:
- Ổn định vận hành tích hợp.

## 14) VẬN HÀNH — Tự động hóa - Nhật ký
- Mục tiêu nghiệp vụ:
- Theo dõi lịch sử chạy automation để truy lỗi nhanh.
- Dữ liệu liên quan:
- Prisma: `AutomationLog`.
- API: `GET /api/automation/logs`.
- Luồng thao tác:
- UI: `src/app/(app)/automation/logs/page.tsx`.
- API -> DB list theo scope/status/date.
- Output/KPI ảnh hưởng:
- Tỷ lệ job thành công/thất bại.

## 15) VẬN HÀNH — Tự động hóa - Chạy tay
- Mục tiêu nghiệp vụ:
- Cho phép admin chạy tay luồng automation khi cần.
- Dữ liệu liên quan:
- Prisma: `AutomationLog`, `Lead`, `Student`.
- API: `POST /api/automation/run`.
- Luồng thao tác:
- UI: `src/app/(app)/automation/run/page.tsx`.
- API validate input -> ghi log queued/running/success/failed.
- Output/KPI ảnh hưởng:
- Khả năng xử lý nhanh tình huống vận hành.

## 16) MARKETING — Báo cáo Meta Ads
- Mục tiêu nghiệp vụ:
- Quản trị chi phí quảng cáo và CPL theo ngày.
- Dữ liệu liên quan:
- Prisma: `MarketingReport`.
- Service: `src/lib/services/marketing.ts`.
- API: `GET /api/admin/marketing/reports`, `POST /api/admin/marketing/report`, `POST /api/admin/marketing/ingest`.
- Luồng thao tác:
- UI: `src/app/(app)/marketing/page.tsx`.
- Service upsert theo `dateKey + branch + source`.
- Output/KPI ảnh hưởng:
- CPL, spend, messages theo nguồn.

## 17) QUẢN TRỊ — Chi nhánh
- Mục tiêu nghiệp vụ:
- Quản lý thực thể chi nhánh để phân tách dữ liệu vận hành.
- Dữ liệu liên quan:
- Prisma: `Branch`, quan hệ tới User/Payroll/Attendance/Marketing.
- API: `GET/POST/PATCH /api/admin/branches`.
- UI: `src/app/(app)/admin/branches/page.tsx`.
- Output/KPI ảnh hưởng:
- Ảnh hưởng scope báo cáo và payroll theo chi nhánh.

## 18) QUẢN TRỊ — Người dùng
- Mục tiêu nghiệp vụ:
- Quản lý tài khoản, role, kích hoạt/vô hiệu hóa.
- Dữ liệu liên quan:
- Prisma: `User`, enum `Role`.
- API: `GET/POST /api/admin/users`, `GET/PATCH /api/admin/users/{id}`.
- UI: `src/app/(app)/admin/users/page.tsx`.
- Quy tắc/logic:
- Admin-only, validate role/password/branch.
- Output/KPI ảnh hưởng:
- Quyền dữ liệu, phân bổ owner, khả năng vận hành.

## 19) QUẢN TRỊ — Phân khách hàng
- Mục tiêu nghiệp vụ:
- Chia khách hàng cho telesales theo thủ công hoặc tự động.
- Dữ liệu liên quan:
- Prisma: `Lead`, `User`, `LeadEvent`.
- API: `POST /api/leads/assign`, `POST /api/leads/auto-assign`.
- UI: `src/app/(app)/admin/assign-leads/page.tsx`.
- Event/log: ghi LeadEvent OWNER_CHANGED.
- Output/KPI ảnh hưởng:
- Ảnh hưởng trực tiếp hiệu suất gọi và tỷ lệ chốt.

## 20) QUẢN TRỊ — Bảng học phí
- Mục tiêu nghiệp vụ:
- Thiết lập mức học phí chuẩn theo tỉnh/hạng bằng.
- Dữ liệu liên quan:
- Prisma: `TuitionPlan`.
- API: `GET/POST /api/tuition-plans`, `GET/PATCH /api/tuition-plans/{id}`.
- UI: `src/app/(app)/admin/tuition-plans/page.tsx`.
- Output/KPI ảnh hưởng:
- Ảnh hưởng thu tiền, công nợ, mốc commission paid50.

## 21) QUẢN TRỊ — Quản trị thông báo
- Mục tiêu nghiệp vụ:
- Điều phối việc sinh thông báo theo quy tắc hệ thống.
- Dữ liệu liên quan:
- Prisma: `Notification`, `NotificationRule`.
- API: `POST /api/notifications/generate`, `PATCH /api/notifications/{id}`.
- UI: `src/app/(app)/admin/notifications/page.tsx`.
- Output/KPI ảnh hưởng:
- Tỷ lệ hoàn thành việc và thời gian xử lý backlog.

## 22) QUẢN TRỊ — Vận hành tự động
- Mục tiêu nghiệp vụ:
- Chạy cron theo lịch để tạo việc, gửi tin, tính snapshot.
- Dữ liệu liên quan:
- Service: `src/lib/services/cron-daily.ts`.
- API: `POST /api/admin/cron/daily`, `POST /api/cron/daily`.
- UI: `src/app/(app)/admin/cron/page.tsx`.
- Output/KPI ảnh hưởng:
- Ổn định vòng lặp vận hành hằng ngày.

## 23) QUẢN TRỊ — Tiến trình gửi tin
- Mục tiêu nghiệp vụ:
- Chạy worker outbound có kiểm soát để đảm bảo thông lượng.
- Dữ liệu liên quan:
- Prisma: `OutboundMessage`, `AutomationLog`.
- Service: `src/lib/services/outbound-worker.ts`.
- API: `POST /api/admin/worker/outbound`, `POST /api/worker/outbound`.
- UI: `src/app/(app)/admin/worker/page.tsx`.
- Output/KPI ảnh hưởng:
- Số tin gửi thành công, độ trễ queue.

## 24) QUẢN TRỊ — Lập lịch
- Mục tiêu nghiệp vụ:
- Theo dõi sức khỏe scheduler để phát hiện job nghẽn.
- Dữ liệu liên quan:
- Service: `src/lib/services/scheduler-health.ts`.
- API: `GET /api/admin/scheduler/health`, `GET /api/scheduler/health`.
- UI: `src/app/(app)/admin/scheduler/page.tsx`.
- Output/KPI ảnh hưởng:
- Độ ổn định tác vụ định kỳ.

## 25) QUẢN TRỊ — Nội dung học viên
- Mục tiêu nghiệp vụ:
- Quản trị kho nội dung cho học viên theo danh mục.
- Dữ liệu liên quan:
- Prisma: `StudentContent`, enum `StudentContentCategory`.
- API: `GET/POST /api/admin/student-content`, `PATCH /api/admin/student-content/{id}`.
- UI: `src/app/(app)/admin/student-content/page.tsx`.
- Output/KPI ảnh hưởng:
- Chất lượng trải nghiệm học viên.

## 26) NHÂN SỰ — KPI nhân sự
- Mục tiêu nghiệp vụ:
- Thiết lập target theo role để đo hiệu suất cá nhân.
- Dữ liệu liên quan:
- Prisma: `EmployeeKpiSetting`, enum `EmployeeKpiRole`.
- Service: `src/lib/services/employee-kpi.ts`.
- API: `GET/POST /api/admin/employee-kpi`, `PATCH /api/admin/employee-kpi/{id}`.
- UI: `src/app/(app)/hr/kpi/page.tsx`.
- Output/KPI ảnh hưởng:
- Target làm input cho Ops Pulse và đánh giá hiệu suất.

## 27) NHÂN SỰ — Hồ sơ lương
- Mục tiêu nghiệp vụ:
- Quản trị cấu hình lương cơ bản/phụ cấp theo hiệu lực.
- Dữ liệu liên quan:
- Prisma: `SalaryProfile`, `CommissionScheme`, `Branch`, `User`.
- API: `GET/POST /api/admin/salary-profiles`, `GET/PATCH /api/admin/salary-profiles/{id}`.
- UI: `src/app/(app)/hr/salary-profiles/page.tsx`.
- Output/KPI ảnh hưởng:
- Input trực tiếp cho tính lương kỳ.

## 28) NHÂN SỰ — Chấm công
- Mục tiêu nghiệp vụ:
- Quản lý ngày công/phép/trễ để tính lương chính xác.
- Dữ liệu liên quan:
- Prisma: `Attendance`, enum `HrAttendanceStatus`, `HrAttendanceSource`.
- API: `GET/POST /api/admin/attendance`, `PATCH /api/admin/attendance/{id}`.
- UI: `src/app/(app)/hr/attendance/page.tsx`.
- Output/KPI ảnh hưởng:
- Ảnh hưởng trực tiếp lương prorate.

## 29) NHÂN SỰ — Tổng lương
- Mục tiêu nghiệp vụ:
- Tổng hợp và chốt kỳ lương theo tháng/chi nhánh.
- Dữ liệu liên quan:
- Prisma: `PayrollRun`, `PayrollItem`, `CommissionLedger`.
- Service: `src/lib/services/payroll.ts`.
- API: `GET /api/admin/payroll`, `POST /api/admin/payroll/generate`, `POST /api/admin/payroll/finalize`.
- UI: `src/app/(app)/hr/payroll/page.tsx`.
- Output/KPI ảnh hưởng:
- Tổng chi lương, commission, hiệu quả vận hành nhân sự.

## Luồng liên thông P0

### A) Khách hàng -> Thu tiền -> KPI ngày
- Tạo/cập nhật khách hàng tại `leads/*` tạo dữ liệu đầu vào cho học viên và thu tiền.
- Khi tạo receipt tại `receipts/*`, số liệu tài chính đi vào `kpi-daily` và dashboard.
- Sai owner hoặc sai ngày HCM sẽ làm sai KPI tài chính theo ngày.

### B) Học viên -> Khóa học -> Lịch học
- Tạo học viên (`students`) cần gắn course để lập lịch.
- Tạo lịch thủ công (`POST /api/schedule`) theo course/student và ghi điểm danh.
- Thiếu course ở student sẽ chặn tạo lịch theo student.

### C) Thông báo/Gửi tin -> Tiến trình gửi tin -> Nhật ký tự động hóa
- Generate notification tạo đầu việc và đầu vào outbound.
- Worker outbound xử lý queue, ghi kết quả vào AutomationLog.
- Trang nhật ký automation dùng để kiểm tra sent/failed và truy lỗi.

### D) Quản trị (Người dùng/Chi nhánh/Phân khách hàng/Bảng học phí) ảnh hưởng luồng nào
- Người dùng + phân quyền: quyết định scope dữ liệu toàn hệ thống.
- Chi nhánh: ảnh hưởng payroll, attendance, marketing report, ops pulse.
- Phân khách hàng: ảnh hưởng KPI telesales, follow-up, doanh thu.
- Bảng học phí: ảnh hưởng thu tiền, mốc paid50, commission/payroll.

## Danh sách thiếu logic/thiếu thao tác

### P0
- Chưa có xóa mềm thống nhất cho `Lead/Student/Course/Receipt`; hiện chủ yếu dùng `isActive` cục bộ.
- Route `courses/{id}/schedule` chưa áp dụng đầy đủ check conflict tương đương `POST /api/schedule` trong mọi tình huống.

### P1
- Thiếu idempotency key chuẩn cho tạo phiếu thu và một số API ghi dữ liệu.
- Một số màn hình chưa có thao tác bulk (vô hiệu hóa user, cập nhật hàng loạt).

### P2
- Chưa có dashboard chuyên biệt theo chi nhánh cho toàn bộ module.
- Chưa có bộ đo SLA xử lý thông báo theo người phụ trách.

## Đề xuất sửa tiếp
- Ưu tiên chuẩn hóa soft-delete policy và audit trail chung (P0).
- Đồng bộ conflict-check cho mọi điểm tạo lịch (`/api/schedule` và `/api/courses/{id}/schedule`) (P0).
- Thêm idempotency cho các API tạo dữ liệu tài chính/automation (P1).
