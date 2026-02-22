# 02 – API Map (Bản đồ API Endpoints)

> **Mục đích**: Liệt kê 100% API endpoints trong repo, phân nhóm theo module. Mỗi endpoint ghi rõ method, path, auth, request/response, side effects.

---

## Auth

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| POST | `/api/auth/login` | Public | Đăng nhập CRM | `{ username, password }` | `{ user, token }` + set cookie `crm_access_token` | — |
| POST | `/api/auth/refresh` | Cookie | Refresh token | — | `{ user, token }` + set cookie | — |
| GET | `/api/auth/me` | Bearer | Thông tin phiên hiện tại | — | `{ user: { id, email, role, permissions } }` | — |
| POST | `/api/auth/logout` | Cookie | Đăng xuất | — | `{ ok: true }` + xoá cookie | — |

---

## Leads (Khách hàng)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/leads` | Bearer + `leads:VIEW` | Danh sách khách hàng (phân trang, filter) | `?page,pageSize,status,ownerId,q,createdFrom,createdTo` | `{ items[], total }` | — |
| POST | `/api/leads` | Bearer + `leads:CREATE` | Tạo khách hàng mới | `{ fullName, phone, source, channel, licenseType, note, tags[] }` | `{ lead }` | Insert LeadEvent(NEW) |
| GET | `/api/leads/{id}` | Bearer + `leads:VIEW` | Chi tiết khách hàng | — | `{ lead }` | — |
| PATCH | `/api/leads/{id}` | Bearer + `leads:UPDATE` | Cập nhật thông tin/trạng thái | `{ status, ownerId, fullName, phone, note, tags[] }` | `{ lead }` | Insert LeadEvent (status change / owner change) |
| GET | `/api/leads/{id}/events` | Bearer + `leads:VIEW` | Danh sách sự kiện khách hàng | — | `{ events[] }` | — |
| POST | `/api/leads/{id}/events` | Bearer + `leads:UPDATE` | Ghi sự kiện (gọi, hẹn, chuyển trạng thái) | `{ type, note, meta }` | `{ event }` | Insert LeadEvent |
| POST | `/api/leads/assign` | Bearer + `leads:ASSIGN` | Phân khách thủ công | `{ leadIds[], ownerId }` | `{ updated }` | Insert LeadEvent(ASSIGNED_OWNER) |
| POST | `/api/leads/auto-assign` | Bearer + `leads:ASSIGN` | Phân khách tự động | `{ branchId, strategy }` | `{ assigned }` | Insert LeadEvent(ASSIGNED_OWNER) |
| POST | `/api/leads/bulk-assign` | Bearer + `leads:ASSIGN` | Phân hàng loạt | `{ leadIds[], ownerId }` | `{ updated }` | Insert LeadEvent(ASSIGNED_OWNER) |
| GET | `/api/leads/stale` | Bearer + `leads:VIEW` | Khách lâu không liên hệ | `?days,page,pageSize` | `{ items[], total }` | — |
| GET | `/api/leads/export` | Bearer + `leads:VIEW` | Export Excel | `?status,from,to` | Excel file (.xlsx) | — |
| GET | `/api/leads/unassigned-count` | Bearer + `leads:VIEW` | Đếm khách chưa phân | — | `{ count }` | — |

---

## KPI

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/kpi/daily` | Bearer + `kpi_daily:VIEW` | KPI phần trăm theo ngày/tháng | `?date=YYYY-MM-DD` | `{ date, directPage: { hasPhoneRate, ... }, tuVan: { appointedRate, ... } }` | — |
| GET | `/api/kpi/targets` | Bearer + `kpi_targets:VIEW` | Mục tiêu KPI | `?branchId,role,dayOfWeek,ownerId,activeOnly` | `{ items[] }` | — |
| POST | `/api/kpi/targets` | Bearer + `kpi_targets:EDIT` | Upsert mục tiêu KPI | `{ branchId, items[]: { role, ownerId?, metricKey, targetValue, dayOfWeek?, isActive? } }` | `{ count, items[] }` | Upsert KpiTarget |

---

## Goals (Mục tiêu)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/goals` | Bearer + `goals:VIEW` | Mục tiêu ngày/tháng | `?periodType,dateKey,monthKey,branchId` | `{ items[] }` | — |
| POST | `/api/goals` | Bearer + `goals:EDIT` | Upsert mục tiêu | `{ periodType, branchId?, dateKey\|monthKey, revenueTarget, dossierTarget, costTarget, note? }` | `{ goal }` | Upsert GoalSetting |

---

## AI / Gợi ý công việc

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/ai/suggestions` | Bearer + `ai_suggestions:VIEW` | Danh sách gợi ý AI | `?date,role,branchId,ownerId` | `{ items[] }` | — |
| POST | `/api/ai/suggestions` | Bearer + `ai_suggestions:CREATE` | Tạo gợi ý thủ công | `{ dateKey, role, branchId?, ownerId?, title, content, scoreColor, actionsJson?, metricsJson? }` | `{ suggestion }` | Insert AiSuggestion |
| POST | `/api/ai/suggestions/{id}/feedback` | Bearer + `ai_suggestions:FEEDBACK` | Phản hồi gợi ý (1 lần/user) | `{ feedbackType, reason, reasonDetail?, note?, actualResult? }` | `{ feedback }` | Upsert AiSuggestionFeedback |
| POST | `/api/ai/suggestions/ingest` | x-service-token + Idempotency-Key | Ingest gợi ý từ N8N | `{ source, runId, suggestions[] }` | `{ ok, count }` | Upsert AiSuggestion, Insert AiLearningHistory |
| GET | `/api/ai/suggestions/analytics` | Bearer + `ai_suggestions:VIEW` | Phân tích gợi ý AI | `?from,to` | `{ analytics }` | — |
| GET | `/api/ai/suggestions/summary` | Bearer + `ai_suggestions:VIEW` | Tổng kết gợi ý | — | `{ summary }` | — |
| GET | `/api/ai/suggestions/trend` | Bearer + `ai_suggestions:VIEW` | Xu hướng gợi ý | — | `{ trend }` | — |

---

## Students (Học viên)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/students` | Bearer + `students:VIEW` | Danh sách học viên | `?page,pageSize,courseId,studyStatus,q` | `{ items[], total }` | — |
| POST | `/api/students` | Bearer + `students:CREATE` | Tạo học viên từ lead | `{ leadId, courseId, studyStatus, tuitionPlanId }` | `{ student }` | Update Lead status→SIGNED, Insert LeadEvent |
| GET | `/api/students/{id}` | Bearer + `students:VIEW` | Chi tiết học viên | — | `{ student }` | — |
| PATCH | `/api/students/{id}` | Bearer + `students:UPDATE` | Cập nhật học viên | `{ courseId, studyStatus, examDate, ... }` | `{ student }` | — |
| POST | `/api/students/bulk-status` | Bearer + `students:UPDATE` | Cập nhật trạng thái hàng loạt | `{ studentIds[], studyStatus }` | `{ updated }` | — |
| GET | `/api/students/{id}/finance` | Bearer + `students:VIEW` | Thông tin tài chính học viên | — | `{ receipts, tuitionPlan, balance }` | — |
| GET | `/api/students/{id}/app-progress` | Bearer + `students:VIEW` | Tiến trình học lý thuyết | — | `{ snapshots[], attempts[], aiSummary }` | — |

---

## Courses (Khoá học)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/courses` | Bearer + `courses:VIEW` | Danh sách khoá học | `?page,pageSize,code,province,licenseType,isActive` | `{ items[], total }` | — |
| POST | `/api/courses` | Bearer + `courses:CREATE` | Tạo khoá học | `{ code, province, licenseType, startDate, examDate, description }` | `{ course }` | — |
| GET | `/api/courses/{id}` | Bearer + `courses:VIEW` | Chi tiết khoá | — | `{ course }` | — |
| PATCH | `/api/courses/{id}` | Bearer + `courses:UPDATE` | Cập nhật khoá | `{ ... }` | `{ course }` | — |
| GET | `/api/courses/{id}/schedule` | Bearer + `schedule:VIEW` | Lịch của khoá | — | `{ items[] }` | — |
| POST | `/api/courses/{id}/schedule` | Bearer + `schedule:CREATE` | Tạo lịch cho khoá | `{ ... }` | `{ item }` | — |

---

## Schedule (Lịch học)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/schedule` | Bearer + `schedule:VIEW` | Danh sách lịch | `?from,to,courseId,status,q,location,page,pageSize` | `{ items[], total }` | — |
| POST | `/api/schedule` | Bearer + `schedule:CREATE` | Tạo lịch thủ công | `{ courseId\|studentId, startAt, endAt, location, note, status, allowOverlap }` + Idempotency-Key | `{ item }` | Check overlap, Insert CourseScheduleItem |
| GET | `/api/schedule/{id}` | Bearer + `schedule:VIEW` | Chi tiết lịch | — | `{ item, attendance }` | — |
| PATCH | `/api/schedule/{id}` | Bearer + `schedule:UPDATE` | Cập nhật lịch | `{ status, ... }` | `{ item }` | — |
| POST | `/api/schedule/{id}/attendance` | Bearer + `schedule:UPDATE` | Điểm danh | `{ records[]: { studentId, status, note? } }` | `{ session, records[] }` | Upsert AttendanceSession + AttendanceRecord, Insert AttendanceAudit |

---

## Receipts (Phiếu thu)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/receipts` | Bearer + `receipts:VIEW` | Danh sách phiếu thu | `?page,pageSize,studentId,date\|from,to,method,q` | `{ items[], total }` | — |
| POST | `/api/receipts` | Bearer + `receipts:CREATE` | Tạo phiếu thu | `{ studentId, amount, method, receivedAt, note }` + Idempotency-Key | `{ receipt }` | Insert Receipt, trigger commission check |
| GET | `/api/receipts/summary` | Bearer + `receipts:VIEW` | Tổng hợp doanh thu | `?from,to,branchId` | `{ total, byMethod }` | — |
| GET | `/api/receipts/{id}` | Bearer + `receipts:VIEW` | Chi tiết phiếu | — | `{ receipt }` | — |
| PATCH | `/api/receipts/{id}` | Bearer + `receipts:UPDATE` | Cập nhật phiếu | `{ amount, method, note }` | `{ receipt }` | — |

---

## Tuition Plans (Bảng học phí)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/tuition-plans` | Bearer + `admin_tuition:VIEW` | Danh sách bảng giá | `?province,licenseType,isActive,page,pageSize` | `{ items[], total }` | — |
| POST | `/api/tuition-plans` | Bearer + `admin_tuition:CREATE` | Tạo bảng giá | `{ province, licenseType, tuition }` | `{ plan }` | — |
| GET | `/api/tuition-plans/{id}` | Bearer + `admin_tuition:VIEW` | Chi tiết | — | `{ plan }` | — |
| PATCH | `/api/tuition-plans/{id}` | Bearer + `admin_tuition:UPDATE` | Cập nhật | `{ tuition, isActive }` | `{ plan }` | — |

---

## Expenses (Chi phí)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/expenses/daily` | Bearer + `expenses:VIEW` | Chi phí ngày | `?date,branchId` | `{ branchId, dateKey, items[] }` | — |
| POST | `/api/expenses/daily` | Bearer + `expenses:EDIT` | Nhập/cập nhật chi phí | `{ date, branchId, items[]: { categoryId, amountVnd, note? } }` | `{ items[] }` | Upsert BranchExpenseDaily |
| GET | `/api/expenses/summary` | Bearer + `expenses:VIEW` | Tổng hợp chi phí tháng | `?month,branchId` | `{ monthKey, expensesTotalVnd, baseSalaryTotalVnd, grandTotalVnd }` | — |
| GET | `/api/expenses/base-salary` | Bearer + `salary:VIEW` | Lương cơ bản | `?month,branchId` | `{ monthKey, rows[] }` | — |
| POST | `/api/expenses/base-salary` | Bearer + `salary:EDIT` | Cập nhật lương cơ bản | `{ month, branchId, items[] }` | `{ rows[] }` | Upsert BranchBaseSalary |

---

## Insights (AI phân tích)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/insights/expenses` | Bearer + `insights:VIEW` | Insight chi phí AI | `?month,date,branchId` | `{ items[] }` | — |
| POST | `/api/insights/expenses/ingest` | x-service-token + Idempotency-Key | Ingest insight từ N8N | `{ branchCode\|branchId, dateKey, monthKey, summary, payloadJson, source, runId }` | `{ ok, item }` | Insert ExpenseInsight |

---

## Notifications & Tasks

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/notifications` | Bearer + `notifications:VIEW` | Danh sách thông báo | `?status,scope,page,pageSize` | `{ items[], total }` | — |
| PATCH | `/api/notifications/{id}` | Bearer + `notifications:UPDATE` | Cập nhật trạng thái | `{ status }` | `{ notification }` | — |
| POST | `/api/notifications/generate` | Bearer + `notifications:CREATE` | Sinh thông báo tự động | `{ scope, dryRun }` | `{ created, preview[] }` | Insert Notification[] |
| GET | `/api/tasks` | Bearer + `notifications:VIEW` | Danh sách việc cần làm | `?status,scope,from,to,q,suggestionId,page,pageSize` | `{ items[], total }` | — |
| POST | `/api/tasks` | Bearer + `notifications:CREATE` | Tạo task | `{ title, message, scope?, priority?, type, ... }` | `{ task }` | Insert Notification |
| PATCH | `/api/tasks/{id}` | Bearer + `notifications:UPDATE` | Cập nhật task | `{ status }` | `{ task }` | — |

---

## Outbound Messaging

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/outbound/messages` | Bearer + `messaging:VIEW` | Hàng đợi outbound | `?status,channel,from,to,page,pageSize` | `{ items[], total }` | — |
| POST | `/api/outbound/messages` | Bearer + `messaging:CREATE` | Tạo tin outbound | `{ channel, templateKey, leadId\|studentId, priority, to }` | `{ item }` | Insert OutboundMessage |
| POST | `/api/outbound/dispatch` | Bearer + `messaging:RUN` | Dispatch batch | `{ limit, retryFailedOnly }` + Idempotency-Key | `{ total, accepted, failed }` | Update OutboundMessage statuses |
| GET | `/api/outbound/jobs` | Bearer + `outbound_jobs:VIEW` | Danh sách job | `?status,branchId,page,pageSize` | `{ items[], total }` | — |
| POST | `/api/outbound/jobs` | Bearer + `outbound_jobs:CREATE` | Tạo job outbound | `{ channel, templateKey, leadId\|studentId, to?, ... }` + Idempotency-Key | `{ outboundMessage, outboundJob }` | Insert OutboundMessage + OutboundJob |
| PATCH | `/api/outbound/jobs/{id}` | x-service-token + Idempotency-Key | N8N cập nhật trạng thái job | `{ status, runId?, lastError? }` | `{ ok, job }` | Update OutboundJob |
| POST | `/api/outbound/callback` | Secret (N8N_CALLBACK_SECRET) | Callback từ N8N | `{ messageId, status, error? }` | `{ ok }` | Update OutboundMessage |

---

## Automation

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/automation/logs` | Bearer + `automation_logs:VIEW` | Nhật ký tự động | `?scope,status,from,to,page,pageSize` | `{ items[], total }` | — |
| POST | `/api/automation/logs` | Bearer + `automation_logs:CREATE` | Ghi log thủ công | `{ channel, milestone?, status?, branchId?, leadId?, studentId?, templateKey?, payload? }` | `{ log }` | Insert AutomationLog |
| POST | `/api/automation/logs/ingest` | x-service-token + Idempotency-Key | N8N đẩy log | `{ branchId, channel, status, milestone?, ... }` | `{ ok, log }` | Insert AutomationLog |
| POST | `/api/automation/run` | Bearer + `automation_run:RUN` | Chạy tay workflow | `{ scope, leadId, studentId, dryRun }` | `{ log }` | Insert AutomationLog |

---

## Admin – Users & Permissions

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/admin/users` | Bearer + `admin_users:VIEW` | Danh sách users | `?q,role,isActive,branchId,page,pageSize` | `{ items[], total }` | — |
| POST | `/api/admin/users` | Bearer + `admin_users:CREATE` | Tạo user | `{ username, email, password, name, role, branchId, groupId }` | `{ user }` | Insert User (bcrypt hash) |
| GET | `/api/admin/users/{id}` | Bearer + `admin_users:VIEW` | Chi tiết | — | `{ user }` | — |
| PATCH | `/api/admin/users/{id}` | Bearer + `admin_users:UPDATE` | Cập nhật | `{ name, role, isActive, branchId, groupId }` | `{ user }` | — |
| POST | `/api/admin/users/bulk-toggle` | Bearer + `admin_users:UPDATE` | Toggle active hàng loạt | `{ userIds[], isActive }` | `{ updated }` | — |
| GET | `/api/admin/users/{id}/permission-overrides` | Bearer + `admin_users:VIEW` | Xem override | — | `{ overrides[] }` | — |
| PUT | `/api/admin/users/{id}/permission-overrides` | Bearer + `admin_users:UPDATE` | Set override | `{ overrides[] }` | `{ overrides[] }` | Upsert UserPermissionOverride |
| GET | `/api/admin/permission-groups` | Bearer + `admin_users:VIEW` | Nhóm quyền | — | `{ items[] }` | — |
| POST | `/api/admin/permission-groups` | Bearer + `admin_users:CREATE` | Tạo nhóm | `{ name, description }` | `{ group }` | Insert PermissionGroup |
| GET | `/api/admin/permission-groups/{id}` | Bearer + `admin_users:VIEW` | Chi tiết nhóm | — | `{ group, rules[] }` | — |
| PATCH | `/api/admin/permission-groups/{id}` | Bearer + `admin_users:UPDATE` | Cập nhật nhóm | `{ name, description }` | `{ group }` | — |
| DELETE | `/api/admin/permission-groups/{id}` | Bearer + `admin_users:DELETE` | Xoá nhóm | — | `{ ok }` | Delete + cascade |
| GET | `/api/admin/permission-groups/{id}/rules` | Bearer + `admin_users:VIEW` | Rules của nhóm | — | `{ rules[] }` | — |
| PUT | `/api/admin/permission-groups/{id}/rules` | Bearer + `admin_users:UPDATE` | Set rules | `{ rules[] }` | `{ rules[] }` | Replace PermissionRule[] |

---

## Admin – Branches

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/admin/branches` | Bearer + `admin_branches:VIEW` | Danh sách chi nhánh | — | `{ items[], total }` | — |
| POST | `/api/admin/branches` | Bearer + `admin_branches:CREATE` | Tạo chi nhánh | `{ name, code }` | `{ branch }` | Insert Branch |
| PATCH | `/api/admin/branches/{id}` | Bearer + `admin_branches:UPDATE` | Cập nhật | `{ name, isActive }` | `{ branch }` | — |
| DELETE | `/api/admin/branches/{id}` | Bearer + `admin_branches:DELETE` | Xoá | — | `{ ok }` | — |

---

## Admin – HR, Payroll, Attendance

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/admin/attendance` | Bearer + `hr_attendance:VIEW` | Chấm công | `?month,userId,branchId` | `{ items[] }` | — |
| POST | `/api/admin/attendance` | Bearer + `hr_attendance:CREATE` | Nhập chấm công | `{ userId, branchId, date, status, minutesLate?, note? }` | `{ attendance }` | Upsert Attendance |
| PATCH | `/api/admin/attendance/{id}` | Bearer + `hr_attendance:UPDATE` | Cập nhật | `{ status, note }` | `{ attendance }` | — |
| GET | `/api/admin/salary-profiles` | Bearer + `hr_payroll_profiles:VIEW` | Hồ sơ lương | `?userId,branchId,month` | `{ items[] }` | — |
| POST | `/api/admin/salary-profiles` | Bearer + `hr_payroll_profiles:CREATE` | Tạo hồ sơ lương | `{ userId, branchId, roleTitle, baseSalaryVnd, ... }` | `{ profile }` | Insert SalaryProfile |
| GET | `/api/admin/salary-profiles/{id}` | Bearer + `hr_payroll_profiles:VIEW` | Chi tiết | — | `{ profile }` | — |
| PATCH | `/api/admin/salary-profiles/{id}` | Bearer + `hr_payroll_profiles:UPDATE` | Cập nhật | `{ ... }` | `{ profile }` | — |
| GET | `/api/admin/employee-kpi` | Bearer + `hr_kpi:VIEW` | KPI nhân sự | `?userId,role,isActive` | `{ items[] }` | — |
| POST | `/api/admin/employee-kpi` | Bearer + `hr_kpi:CREATE` | Tạo KPI nhân sự | `{ userId, role, effectiveFrom, targetsJson }` | `{ setting }` | Insert EmployeeKpiSetting |
| PATCH | `/api/admin/employee-kpi/{id}` | Bearer + `hr_kpi:UPDATE` | Cập nhật | — | `{ setting }` | — |
| GET | `/api/admin/payroll` | Bearer + `hr_total_payroll:VIEW` | Kỳ lương | `?month,branchId` | `{ items[] }` | — |
| POST | `/api/admin/payroll/generate` | Bearer + `hr_total_payroll:RUN` | Generate payroll | `{ month, branchId }` | `{ run }` | Insert/Update PayrollRun + PayrollItem[] |
| POST | `/api/admin/payroll/finalize` | Bearer + `hr_total_payroll:RUN` | Finalize kỳ lương | `{ month, branchId }` | `{ run }` | Update PayrollRun status→FINAL |
| GET | `/api/admin/commissions` | Bearer + `hr_total_payroll:VIEW` | Hoa hồng | `?month,branchId` | `{ items[] }` | — |
| POST | `/api/admin/commissions` | Bearer + `hr_total_payroll:RUN` | Tính hoa hồng | — | `{ items[] }` | Insert CommissionLedger[] |
| POST | `/api/admin/commissions/rebuild` | Bearer + `hr_total_payroll:RUN` | Rebuild hoa hồng tháng | `{ month, branchId }` | `{ count }` | Delete + re-insert CommissionLedger |
| POST | `/api/admin/commissions/paid50/rebuild` | Bearer + `hr_total_payroll:RUN` | Rebuild hoa hồng đã đóng 50% | `{ month, branchId }` | `{ count }` | Commission recalc |
| GET | `/api/me/payroll` | Bearer + `my_payroll:VIEW` | Lương cá nhân | `?month=YYYY-MM` | `{ items[] }` | — |

---

## Admin – Automation & N8N

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| POST | `/api/admin/cron/daily` | Bearer + `admin_automation_admin:RUN` | Chạy cron hàng ngày | `{ dryRun, force }` | `{ ok, counts }` | Generate notifications, run automation |
| POST | `/api/admin/worker/outbound` | Bearer + `admin_send_progress:RUN` | Chạy worker outbound | `{ batchSize, dryRun }` | `{ ok, result: { sent, failed } }` | Dispatch outbound messages |
| GET | `/api/admin/scheduler/health` | Bearer + `admin_plans:VIEW` | Sức khoẻ scheduler | — | `{ summary, queues[] }` | — |
| GET | `/api/admin/ops/pulse` | Bearer + `ops_ai_hr:VIEW` | Ops Pulse snapshot | `?role,ownerId,dateKey,limit` | `{ items[] }` | — |
| GET | `/api/admin/n8n/workflows` | Bearer + `ops_n8n:VIEW` | Danh sách workflow N8N | — | `{ overview, workflows[] }` | — |
| GET | `/api/admin/n8n/workflows/{id}` | Bearer + `ops_n8n:VIEW` | Chi tiết workflow | — | `{ workflow }` | — |
| GET | `/api/admin/automation/overview` | Bearer + `ops_n8n:VIEW` | Tổng quan giám sát | `?date` | `{ dateKey, jobs, logs }` | — |
| GET | `/api/admin/automation/jobs` | Bearer + `ops_n8n:VIEW` | Danh sách OutboundJob | `?date,status,branchId,channel,runId,limit` | `{ items[], total }` | — |
| GET | `/api/admin/automation/logs` | Bearer + `ops_n8n:VIEW` | Log chi tiết | `?date,milestone,branchId,runId,suggestionId,limit` | `{ items[], total }` | — |
| GET | `/api/admin/automation/errors` | Bearer + `ops_n8n:VIEW` | Top lỗi | `?date,limit` | `{ items[] }` | — |

---

## Admin – Other

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/admin/student-content` | Bearer + `admin_student_content:VIEW` | Nội dung học viên | `?category,isPublished,page,pageSize` | `{ items[], total }` | — |
| POST | `/api/admin/student-content` | Bearer + `admin_student_content:CREATE` | Tạo nội dung | `{ category, title, body, isPublished }` | `{ content }` | — |
| PATCH | `/api/admin/student-content/{id}` | Bearer + `admin_student_content:UPDATE` | Cập nhật | — | `{ content }` | — |
| GET | `/api/admin/marketing/reports` | Bearer + `marketing_meta_ads:VIEW` | Báo cáo marketing | `?from,to,branchId,source` | `{ items[], total }` | — |
| GET | `/api/admin/tracking-codes` | Bearer + `admin_tracking:VIEW` | Tracking codes | — | `{ items[] }` | — |
| POST | `/api/admin/tracking-codes` | Bearer + `admin_tracking:CREATE` | Tạo tracking code | `{ site, key, name, placement, code }` | `{ item }` | — |
| PATCH | `/api/admin/tracking-codes/{id}` | Bearer + `admin_tracking:UPDATE` | Cập nhật | — | `{ item }` | — |
| DELETE | `/api/admin/tracking-codes/{id}` | Bearer + `admin_tracking:DELETE` | Xoá | — | `{ ok }` | — |

---

## Marketing (Ingest)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| POST | `/api/marketing/ingest` | Secret (MARKETING_SECRET) | N8N đẩy data marketing | `{ ... }` | `{ ok }` | Upsert MarketingReport |
| POST | `/api/marketing/report` | Secret (MARKETING_SECRET) | Báo cáo từ N8N | `{ date, source, spendVnd, messages, branchId? }` | `{ ok }` | Upsert MarketingReport |
| GET | `/api/marketing/metrics` | Bearer + `marketing_meta_ads:VIEW` | Metrics tổng hợp | `?from,to` | `{ metrics }` | — |

---

## Ops

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| POST | `/api/ops/pulse` | Secret (OPS_SECRET) | N8N đẩy Ops snapshot | `{ role, dateKey, ... }` | `{ ok }` | Upsert OpsPulse |

---

## Student Portal

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| POST | `/api/student/auth/login` | Public | Đăng nhập học viên | `{ phone, password }` | `{ student }` + set cookie | — |
| POST | `/api/student/auth/register` | Public | Đăng ký tài khoản | `{ phone, password }` | `{ student }` + set cookie | Insert StudentAccount |
| POST | `/api/student/auth/logout` | Public | Đăng xuất | — | `{ ok }` + xoá cookie | — |
| GET | `/api/student/me` | Student cookie | Thông tin phiên | — | `{ student, lead }` | — |
| GET | `/api/student/content` | Student cookie | Nội dung hướng dẫn | `?category` | `{ items[] }` | — |

---

## Student Progress (Service Ingest)

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| POST | `/api/student-progress/daily` | x-service-token | Đẩy snapshot học ngày | `{ studentId, dateKey, ... }` | `{ ok }` | Upsert AppDailySnapshot |
| POST | `/api/student-progress/attempt` | x-service-token | Đẩy kết quả bài thi | `{ studentId, attemptId, ... }` | `{ ok }` | Insert AppAttemptSummary |
| POST | `/api/student-progress/ai-summary` | x-service-token | Đẩy AI summary | `{ studentId, ... }` | `{ ok }` | Upsert AppAiSummary |
| POST | `/api/student-progress/events` | x-service-token | Đẩy event log | `{ studentId, events[] }` | `{ ok }` | Insert AppEventLog[] |

---

## Public

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/public/tuition-plans` | Public | Bảng học phí công khai | — | `{ items[] }` | — |
| POST | `/api/public/lead` | Public | Đăng ký từ landing | `{ fullName, phone, ... }` | `{ lead }` | Insert Lead + LeadEvent |
| POST | `/api/public/seed-tuition` | Public | Seed bảng học phí | — | `{ ok }` | Upsert TuitionPlan[] |

---

## System

| Method | Path | Auth | Mô tả | Request | Response | Side Effects |
|--------|------|------|-------|---------|----------|-------------|
| GET | `/api/health` | Public | Health check | — | `{ ok, timestamp }` | — |
| GET | `/api/events` | Bearer | SSE event stream | — | SSE stream | — |
| GET | `/api/docs` | Public | API docs page | — | HTML | — |
| GET | `/api/templates` | Public | Message templates | — | `{ items[] }` | — |
| GET | `/api/tracking-codes` | Public | Tracking codes inject | — | `{ items[] }` | — |
| POST | `/api/cron/daily` | Secret (CRON_SECRET) | Cron daily từ N8N | — | `{ ok }` | Daily automation |
| POST | `/api/worker/outbound` | Secret (WORKER_SECRET) | Worker từ N8N | — | `{ ok }` | Dispatch messages |
| GET | `/api/reports/qa` | Bearer | QA report | — | `{ report }` | — |
| GET | `/api/instructors` | Bearer | Danh sách giáo viên | — | `{ items[] }` | — |
| POST | `/api/instructors` | Bearer | Tạo giáo viên | `{ name, phone }` | `{ instructor }` | Insert Instructor |
| GET | `/api/instructors/{id}` | Bearer | Chi tiết giáo viên | — | `{ instructor }` | — |
| PATCH | `/api/instructors/{id}` | Bearer | Cập nhật giáo viên | `{ name, status }` | `{ instructor }` | — |
| GET | `/api/practical-lessons` | Bearer | Bài thực hành | `?studentId,instructorId` | `{ items[] }` | — |
| POST | `/api/practical-lessons` | Bearer | Tạo bài thực hành | `{ ... }` | `{ lesson }` | Insert PracticalLesson |
