# AI_AUTOMATION_MASTERPLAN

## Mục tiêu chung
- Dùng n8n làm bộ não xử lý AI và luồng tự động.
- CRM chỉ cung cấp dữ liệu qua API, nhận kết quả ingest, hiển thị cho người dùng, ghi log và lưu phản hồi.
- Mọi API mới phải đi qua RBAC deny-by-default.

## Nguyên tắc tích hợp n8n
- Không gọi AI trực tiếp từ app.
- Ingest luôn có `x-service-token` và `Idempotency-Key`.
- Retry theo backoff tăng dần, tối đa 3 lần.
- Lưu phản hồi người dùng để hệ thống học dần qua `AiLearningHistory`.

## Vòng phản hồi bắt buộc
- Mỗi gợi ý ở trang Trợ lý công việc phải được người dùng phản hồi theo 1 trong 3 trạng thái: `Hữu ích`, `Không hữu ích`, `Đã làm xong`.
- CRM ghi nhận phản hồi qua `POST /api/ai/suggestions/{id}/feedback` với ràng buộc `mỗi user chỉ phản hồi 1 lần / gợi ý`.
- n8n đọc dữ liệu phản hồi + kết quả thực tế (data/hẹn/đến/ký) để tối ưu prompt và luật ưu tiên cho lần chạy tiếp theo.
- Dashboard/luồng vận hành ưu tiên dùng các gợi ý có tỷ lệ phản hồi hữu ích cao và loại bớt các mẫu bị đánh giá không phù hợp.

## Cơ hội AI theo module
### Leads
- Quick win: chấm điểm nóng/lạnh và gợi ý gọi lại.
- Mid: dự đoán thời điểm liên hệ tốt nhất theo lịch sử.
- Long: phân phối lead tự động theo hiệu suất thực tế.
- Endpoint chính: `/api/leads`, `/api/ai/suggestions`, `/api/tasks`.

### KPI
- Quick win: cảnh báo KPI % thấp hơn mục tiêu theo ngày.
- Mid: gợi ý hành động theo nghẽn từng bước funnel.
- Long: dự báo đạt/chưa đạt mục tiêu tháng theo xu hướng.
- Endpoint chính: `/api/kpi/daily`, `/api/kpi/targets`, `/api/goals`.

### Trợ lý công việc
- Quick win: danh sách việc ưu tiên theo màu Đỏ/Vàng/Xanh.
- Mid: cá nhân hóa gợi ý theo vai trò và lịch sử phản hồi.
- Long: tối ưu gợi ý theo kết quả thật của từng chi nhánh.
- Endpoint chính: `/api/ai/suggestions`, `/api/ai/suggestions/ingest`, `/api/ai/suggestions/{id}/feedback`.

### Gọi nhắc
- Quick win: tạo danh sách gọi nhắc từ gợi ý.
- Mid: chọn mẫu tin phù hợp theo ngữ cảnh.
- Long: tối ưu lịch gửi theo tỷ lệ phản hồi.
- Endpoint chính: `/api/outbound/messages`, `/api/outbound/jobs`, `/api/outbound/dispatch`.

### Học viên/Khóa/Lịch học
- Quick win: nhắc lịch và cảnh báo nguy cơ vắng học.
- Mid: gợi ý lịch bù theo tình hình lớp.
- Long: dự báo tỷ lệ hoàn thành khóa theo cohort.
- Endpoint chính: `/api/students`, `/api/courses`, `/api/schedule`, `/api/tasks`.

### Thu tiền/Công nợ
- Quick win: ưu tiên danh sách cần gọi thu tiền.
- Mid: dự đoán khách có nguy cơ trễ đóng.
- Long: mô hình dự báo dòng tiền theo tuần/tháng.
- Endpoint chính: `/api/receipts`, `/api/receipts/summary`, `/api/tasks`.

### Chi phí
- Quick win: cảnh báo tăng chi phí bất thường.
- Mid: gợi ý cắt giảm theo danh mục.
- Long: mô hình ngân sách theo mùa vụ tuyển sinh.
- Endpoint chính: `/api/expenses/daily`, `/api/expenses/summary`, `/api/insights/expenses`.

### Lương/Commission
- Quick win: cảnh báo biến động bất thường trước chốt lương.
- Mid: gợi ý truy vết nguyên nhân tăng/giảm.
- Long: dự báo chi phí nhân sự theo kế hoạch vận hành.
- Endpoint chính: `/api/admin/payroll`, `/api/admin/commissions`.

### Quản trị/RBAC
- Quick win: nhắc kiểm tra quyền quá rộng.
- Mid: gợi ý role group theo hành vi sử dụng.
- Long: tự động đề xuất siết quyền theo rủi ro.
- Endpoint chính: `/api/admin/permission-groups/*`, `/api/admin/users/{id}/permission-overrides`.

### API Hub
- Quick win: tra cứu endpoint + ví dụ đấu nối nhanh.
- Mid: catalog theo use-case.
- Long: checklist chất lượng tích hợp theo đối tác.

## Mapping endpoint cho control-plane AI
- `GET/POST /api/ai/suggestions`
- `POST /api/ai/suggestions/ingest`
- `POST /api/ai/suggestions/{id}/feedback`
- `GET/POST /api/tasks`
- `GET/POST /api/automation/logs`
- `GET /api/admin/n8n/workflows`

## Lộ trình ROI
### Quick wins (1-2 tuần)
- Trợ lý công việc + phản hồi.
- Tasks API cho n8n đẩy việc.
- Nhật ký tự động hóa chuẩn.

### Mid (1 tháng)
- Chấm điểm lead theo hành vi.
- Cảnh báo công nợ/chi phí theo ngưỡng.
- Dashboard theo nhóm việc ưu tiên.

### Long (3 tháng)
- Learning loop liên module.
- Tối ưu phân quyền theo hành vi.
- Điều phối vận hành đa chi nhánh theo dữ liệu thật.
