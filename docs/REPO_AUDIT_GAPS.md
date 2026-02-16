# REPO_AUDIT_GAPS

## 1) Nghiệp vụ
### Đã có
- Luồng chính: khách hàng, KPI %, mục tiêu, học viên/khóa/lịch, thu tiền, chi phí, lương, tự động hóa.
- Trợ lý công việc đã có ingest + feedback + action tạo gọi nhắc.

### Khoảng trống
- Một số nhãn ở API mẫu còn thuật ngữ kỹ thuật (đã giảm nhưng cần rà thêm theo từng màn hình).
- Chưa có checklist vận hành tập trung cho toàn bộ admin ở một trang riêng (đã bổ sung trang mới trong lần cập nhật này).

## 2) RBAC
### Đã có
- Deny-by-default cho API qua `route-permissions-map`.
- Có audit coverage route permission.
- Có scope owner/branch/system.

### Khoảng trống đã xử lý
- Thiếu mapping cho các route mới:
  - `POST /api/ai/suggestions`
  - `GET/POST /api/tasks`
  - `POST /api/automation/logs`
- Đã thêm vào `src/lib/route-permissions-map.ts`.

## 3) API contract
### Đã có
- Chuẩn lỗi `jsonError` với `ok:false` + `error.code` + `error.message`.
- Có API catalog và integration spec.

### Khoảng trống đã xử lý
- Thiếu nhóm contract cho tasks/control-plane.
- Đã bổ sung vào `API_INTEGRATION_SPEC.md` và `src/lib/api-catalog.ts`.

## 4) Data model (Prisma)
### Đã có
- `AiSuggestion`, `AiSuggestionFeedback`, `AutomationLog`, `Notification`.

### Khoảng trống đã xử lý
- Chưa có bảng lịch sử học từ phản hồi đa module.
- Đã thêm `AiLearningHistory` + migration + index cần thiết.

## 5) API Hub & Luồng tự động
### Đã có
- API Hub tra cứu endpoint.
- Endpoint admin lấy danh sách luồng n8n.

### Khoảng trống đã xử lý
- Chưa tách rõ phần API tích hợp và phần Luồng tự động.
- Đã nâng cấp API Hub thành 2 tab: `API tích hợp` và `Luồng tự động (n8n)`.

## 6) Gợi ý tiếp theo (P1/P2)
### P1
- Thêm test route-level cho `/api/tasks` và `POST /api/ai/suggestions`.
- Thêm dashboard nhỏ cho chất lượng gợi ý theo tỷ lệ phản hồi đúng/chưa đúng.

### P2
- Chuẩn hóa danh mục action label Việt hóa ở một nguồn duy nhất.
- Tự động tổng hợp báo cáo hiệu quả luồng n8n theo tuần.
