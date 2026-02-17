# AI_OPPORTUNITIES_AND_AUTOMATION_PLAN

## Nguyên tắc kiến trúc
- n8n xử lý logic AI (phân tích, suy luận, tạo đề xuất, orchestration).
- CRM chỉ làm 4 việc: cung cấp API dữ liệu, nhận ingest kết quả, hiển thị cho người dùng, lưu lịch sử phản hồi.
- Mọi route API mới đi qua RBAC deny-by-default và route-permission map.

## 1) Leads (Khách hàng)
### a) AI có thể làm gì
- Chấm điểm lead nóng/lạnh theo lịch sử tương tác.
- Gợi ý thời điểm gọi lại tốt nhất theo hành vi phản hồi.
- Gợi ý người phụ trách phù hợp khi lead bị treo quá lâu.
### b) Input data cần lấy
- `Lead`, `LeadEvent`, `LeadMessage`, owner, branch, trạng thái pipeline.
### c) Output lưu ở đâu
- Đề xuất vào `AiSuggestion` (`actionsJson` chứa hành động gợi ý).
- Log chạy vào `AutomationLog`.
### d) Endpoint cần có
- `GET /api/leads`
- `GET/POST /api/ai/suggestions`
- `POST /api/ai/suggestions/ingest`
### e) RBAC
- Xem: telesales/direct_page theo owner+branch, manager theo branch, admin toàn hệ thống.
- Chạy ingest: service token route.
- Áp dụng: user có quyền `messaging:RUN` hoặc `leads:UPDATE`.
### f) Lưu lịch sử để học dần
- `AiSuggestionFeedback` + `AiLearningHistory` (moduleKey=`leads`, useCaseKey=`lead_scoring|next_best_action`).

## 2) KPI
### a) AI có thể làm gì
- Tự phát hiện điểm nghẽn KPI % theo ngày/tháng.
- Cảnh báo sớm khi lệch mục tiêu theo vai trò/nhân sự.
### b) Input data cần lấy
- `GET /api/kpi/daily`, `GET /api/kpi/targets`, `GET /api/goals`.
### c) Output lưu ở đâu
- `AiSuggestion`, `AiSuggestionFeedback`, `AiLearningHistory`.
### d) Endpoint cần có
- `GET /api/kpi/daily`
- `GET/POST /api/kpi/targets`
- `GET/POST /api/goals`
- `GET/POST /api/ai/suggestions`
### e) RBAC
- KPI xem theo scope role/branch/owner.
- Chỉnh mục tiêu: manager/admin theo scope.
### f) Lưu lịch sử
- Track gap thực tế vs target trong `AiLearningHistory.outputJson`.

## 3) Trợ lý công việc
### a) AI có thể làm gì
- Gợi ý việc ưu tiên theo màu Đỏ/Vàng/Xanh.
- Đề xuất checklist hành động theo vai trò.
### b) Input data cần lấy
- KPI %, task backlog, outbound queue, lịch học và công nợ.
### c) Output lưu ở đâu
- `AiSuggestion.actionsJson`, `AiSuggestionFeedback`.
### d) Endpoint cần có
- `GET/POST /api/ai/suggestions`
- `POST /api/ai/suggestions/{id}/feedback`
### e) RBAC
- Xem gợi ý theo quyền module `ai_kpi_coach`.
- Tạo gợi ý thủ công: quyền `CREATE`.
### f) Lưu lịch sử
- `AiLearningHistory` (moduleKey=`ai_kpi_coach`, useCaseKey=`daily_coach`).

## 4) Outbound / Gửi tin
### a) AI có thể làm gì
- Chọn nhóm khách gọi nhắc theo ưu tiên.
- Gợi ý template phù hợp theo ngữ cảnh.
### b) Input data cần lấy
- Queue outbound, lead/student context, notification scope.
### c) Output lưu ở đâu
- `OutboundMessage`, `AutomationLog`.
### d) Endpoint cần có
- `GET /api/outbound/messages`
- `POST /api/outbound/messages`
- `POST /api/outbound/jobs`
- `POST /api/outbound/dispatch`
### e) RBAC
- Xem: `messaging:VIEW`
- Tạo/chạy: `messaging:CREATE|RUN`
### f) Lưu lịch sử
- Đẩy kết quả gửi (sent/failed/skipped) + phản hồi user vào `AiLearningHistory`.

## 5) Học viên / Khóa học / Lịch học
### a) AI có thể làm gì
- Dự đoán rủi ro vắng học.
- Gợi ý lịch bù theo tỷ lệ vắng/trễ.
- Nhắc việc trước buổi học theo mức ưu tiên.
### b) Input data cần lấy
- `Student`, `Course`, `CourseScheduleItem`, `AttendanceRecord`.
### c) Output lưu ở đâu
- `Notification` (task), `AiSuggestion`, `AutomationLog`.
### d) Endpoint cần có
- `GET /api/students`, `GET /api/courses`, `GET/POST /api/schedule`
- `GET/POST /api/tasks`
### e) RBAC
- Telesales/direct_page theo owner+branch; manager theo branch.
### f) Lưu lịch sử
- Learning từ tỷ lệ đi học sau nhắc việc vào `AiLearningHistory`.

## 6) Thu tiền / Công nợ
### a) AI có thể làm gì
- Dự đoán nguy cơ trễ thu.
- Gợi ý danh sách cần gọi thu tiền trong ngày.
### b) Input data cần lấy
- `Receipt`, `StudentFinance`, notification công nợ.
### c) Output lưu ở đâu
- `Notification`, `OutboundMessage`, `AiSuggestion`.
### d) Endpoint cần có
- `GET/POST /api/receipts`
- `GET /api/receipts/summary`
- `GET/POST /api/tasks`
### e) RBAC
- Finance/manager theo branch; admin toàn hệ thống.
### f) Lưu lịch sử
- Theo dõi “đã nhắc -> đã thu” trong `AiLearningHistory`.

## 7) Chi phí
### a) AI có thể làm gì
- Phát hiện bất thường chi phí ngày/tháng.
- Gợi ý cắt giảm theo danh mục.
### b) Input data cần lấy
- `BranchExpenseDaily`, `BranchBaseSalary`, `ExpenseInsight`.
### c) Output lưu ở đâu
- `ExpenseInsight`, `AiSuggestion`.
### d) Endpoint cần có
- `GET/POST /api/expenses/daily`
- `GET /api/expenses/summary`
- `GET/POST /api/insights/expenses` (ingest dùng service token)
### e) RBAC
- Ops/finance theo branch; admin đa chi nhánh.
### f) Lưu lịch sử
- Lưu chất lượng insight vào `AiLearningHistory` (moduleKey=`expenses`).

## 8) Lương / Commission
### a) AI có thể làm gì
- Cảnh báo biến động bất thường trong kỳ lương.
- Gợi ý truy vết khoản tăng/giảm lớn.
### b) Input data cần lấy
- Payroll run/items, commission ledgers, attendance.
### c) Output lưu ở đâu
- `AutomationLog`, `AiSuggestion`.
### d) Endpoint cần có
- `GET /api/admin/payroll`
- `POST /api/admin/payroll/generate`
- `GET /api/admin/commissions`
### e) RBAC
- HR/finance/admin theo phân quyền hiện có.
### f) Lưu lịch sử
- Track false-positive trong `AiLearningHistory`.

## 9) Quản trị / RBAC
### a) AI có thể làm gì
- Phát hiện user có quyền quá rộng.
- Gợi ý role group tối ưu theo hành vi sử dụng thật.
### b) Input data cần lấy
- Permission group/rules, override theo user, audit route coverage.
### c) Output lưu ở đâu
- `AiSuggestion` (module admin), `AiLearningHistory`.
### d) Endpoint cần có
- `GET/PUT /api/admin/permission-groups/*`
- `GET/PUT /api/admin/users/{id}/permission-overrides`
### e) RBAC
- Chỉ admin hệ thống.
### f) Lưu lịch sử
- Ghi quyết định giữ/chấp nhận gợi ý quyền vào `AiLearningHistory`.

## 10) API Hub
### a) AI có thể làm gì
- Đề xuất endpoint tích hợp theo use case nhập.
- Tạo mẫu payload/curl an toàn (REDACTED token).
### b) Input data cần lấy
- `API_CATALOG`, `API_INTEGRATION_SPEC`, permission matrix.
### c) Output lưu ở đâu
- `AiSuggestion` + docs markdown.
### d) Endpoint cần có
- `GET /api/auth/me` (kiểm tra quyền)
- Catalog hiển thị từ `src/lib/api-catalog.ts`
### e) RBAC
- Chỉ user có `api_hub:VIEW`.
### f) Lưu lịch sử
- Lưu feedback chất lượng docs vào `AiLearningHistory`.

## Ưu tiên theo ROI
### Quick wins (1-2 tuần)
- Trợ lý công việc theo KPI% + tạo danh sách gọi + feedback vòng lặp.
- Tasks alias (`/api/tasks`) cho n8n đẩy việc cần làm.
- Ghi automation log chuẩn qua API để theo dõi hiệu quả.

### Mid (1 tháng)
- Lead scoring theo hành vi + next-best-action theo từng owner.
- Cảnh báo chi phí/công nợ theo ngưỡng + action gợi ý tự động.
- Tối ưu outbound template theo tỉ lệ phản hồi.

### Long (3 tháng)
- Learning loop đa module (leads, finance, schedule, HR) bằng `AiLearningHistory`.
- Gợi ý RBAC tự động theo hành vi và mức rủi ro.
- Điều phối liên chi nhánh theo tải công việc và tỷ lệ chuyển đổi.

## Quy ước response lỗi tích hợp
- Tuân theo `jsonError`:
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Thiếu dữ liệu bắt buộc"
  }
}
```

## Files touched
- `AI_OPPORTUNITIES_AND_AUTOMATION_PLAN.md`
- `API_INTEGRATION_SPEC.md`
- `src/lib/api-catalog.ts`
- `src/app/(app)/admin/huong-dan-ai/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/lib/admin-menu.ts`
- `src/lib/ui-permissions.ts`
- `src/app/api/ai/suggestions/route.ts`
- `src/lib/services/ai-kpi-coach.ts`
- `src/app/api/tasks/route.ts`
- `src/app/api/automation/logs/route.ts`
- `src/lib/route-permissions-map.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260216095303_ai_learning_history/migration.sql`

## Kết quả verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma db seed`: PASS
