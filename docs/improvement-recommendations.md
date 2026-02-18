# Đề xuất cải tiến CRM Thầy Duy

## I. 🔴 Ưu tiên cao — Nên làm sớm

### 1. Tích hợp Zalo OA thật
**Hiện tại**: Outbound message worker chạy nhưng chưa gửi tin thật (webhook mock).
**Cần làm**: Kết nối Zalo OA API v3 để gửi tin nhắn ZNS (Zalo Notification Service) thực tế — xác nhận đăng ký, nhắc lịch học, thông báo kết quả thi.
**Giá trị**: Tự động chăm sóc khách hàng, giảm tải telesales.

### 2. Webhook nhận lead từ Facebook/Zalo tự động
**Hiện tại**: Lead được tạo thủ công hoặc qua landing page form.
**Cần làm**: API webhook cho N8N đẩy lead từ Facebook Lead Ads và Zalo Ads vào CRM realtime.
**Giá trị**: Không miss lead, phản hồi nhanh hơn.

### 3. Dashboard real-time (WebSocket / SSE)
**Hiện tại**: Dashboard cần refresh thủ công hoặc có checkbox "tự làm mới 60s".
**Cần làm**: Sử dụng Server-Sent Events (SSE) để push cập nhật realtime — lead mới, payment mới, KPI thay đổi.
**Giá trị**: Admin và manager nắm tình hình tức thì.

---

## II. 🟡 Ưu tiên trung bình — Nâng cao trải nghiệm

### 4. Báo cáo xuất PDF / Excel nâng cao
**Hiện tại**: Có CSV export cho leads.
**Cần làm**: Báo cáo PDF đẹp (logo, bảng màu) cho KPI hàng tháng, doanh thu, danh sách học viên → gửi email tự động cho quản lý.
**Giá trị**: Chuyên nghiệp hóa báo cáo, tiết kiệm thời gian.

### 5. Kanban board cho lead pipeline
**Hiện tại**: Leads hiển thị dạng bảng (table) với filter status.
**Cần làm**: Thêm view Kanban drag-and-drop — kéo thả lead qua các cột: MỚI → CÓ SĐT → ĐÃ HẸN → ĐÃ ĐẾN → KÝ.
**Giá trị**: Trực quan hóa pipeline, telesales xử lý nhanh hơn.

### 6. Lịch sử gọi điện tích hợp
**Hiện tại**: Event log ghi nhận "đã gọi" nhưng không có chi tiết.
**Cần làm**: Tích hợp tổng đài IP (Stringee/VOIP24h) — ghi log thời gian gọi, thời lượng, ghi âm. Click-to-call từ CRM.
**Giá trị**: Quản lý chất lượng tư vấn, đào tạo nhân viên mới.

### 7. Mobile-responsive cải tiến
**Hiện tại**: UI desktop-first, responsive cơ bản.
**Cần làm**: Tối ưu hóa layout cho mobile/tablet — sidebar collapse, bottom nav, touch-friendly buttons. Hoặc PWA wrapper.
**Giá trị**: Telesales/giáo viên dùng CRM ngoài hiện trường.

### 8. Notification center nâng cao
**Hiện tại**: Có notification system nhưng chưa có push notification.
**Cần làm**: Web Push Notification (service worker) + Zalo push. Badge count trên sidebar.
**Giá trị**: Nhân viên không bỏ lỡ thông báo quan trọng.

---

## III. 🟢 Nice-to-have — Cải thiện dài hạn

### 9. Multi-branch dashboard so sánh
**Hiện tại**: Dashboard filter theo branch nhưng không có view so sánh.
**Cần làm**: Chart so sánh KPI giữa các chi nhánh, ranking telesales, heatmap hiệu suất.
**Giá trị**: Quản lý nhìn tổng quan nhiều cơ sở.

### 10. Customer journey timeline
**Hiện tại**: Lead events log dạng danh sách.
**Cần làm**: Timeline visual đẹp từ lúc khách đăng ký → tư vấn → hẹn → đến → ký → học → thi → ra trường. Tích hợp chat history, call log.
**Giá trị**: 360° view về một khách hàng.

### 11. A/B testing cho landing page
**Hiện tại**: Landing page tĩnh.
**Cần làm**: Tích hợp UTM tracking, variant testing, conversion tracking từ landing → lead → signed.
**Giá trị**: Tối ưu chi phí marketing.

### 12. API rate-limit dashboard
**Hiện tại**: Rate limit có nhưng không có monitoring.
**Cần làm**: Dashboard admin hiển thị API usage, rate-limit violations, response times.
**Giá trị**: Phát hiện sớm vấn đề performance.

---

## IV. 🏗️ Kỹ thuật — Tech debt

| Hạng mục | Chi tiết |
|----------|----------|
| **Unit tests** | Chưa có test suite. Cần thêm Jest/Vitest cho service layer |
| **E2E tests** | Thêm Playwright test cho critical flows (login, create lead, payment) |
| **API docs** | Tạo OpenAPI/Swagger spec cho tất cả endpoints |
| **Error tracking** | Tích hợp Sentry cho production error monitoring |
| **Database backup** | Cron job backup PostgreSQL hàng ngày lên cloud storage |
| **CI/CD** | GitHub Actions: lint, type-check, test, build, deploy tự động |
