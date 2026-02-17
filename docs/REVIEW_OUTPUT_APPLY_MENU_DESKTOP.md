# REVIEW_OUTPUT_APPLY_MENU_DESKTOP

## 1) Danh sách files changed
- `src/app/(app)/ai/kpi-coach/page.tsx`
- `src/app/api/tasks/route.ts`
- `src/app/api/outbound/jobs/route.ts`
- `src/components/mobile/MobileAdminMenu.tsx`
- `src/app/(app)/layout.tsx`
- `src/lib/admin-menu.ts`
- `src/lib/route-permissions-map.ts`
- `src/lib/api-catalog.ts`
- `src/lib/n8n-workflows.ts`
- `prisma/migrations/20260217004000_ai_feedback_loop_required/migration.sql` (đổi thứ tự timestamp để chạy đúng phụ thuộc)

## 2) Routes/pages mới + mô tả
- `/ai/kpi-coach`
  - Thêm nút `Áp dụng` cho từng gợi ý.
  - `Áp dụng` đọc `actionsJson` và gọi API tương ứng:
    - `CREATE_TASK` -> `POST /api/tasks`
    - `CREATE_REMINDER` -> `POST /api/tasks` (type `REMINDER`)
    - `CREATE_CALL_LIST` -> `POST /api/outbound/jobs`
  - Sau khi áp dụng thành công: hiển thị badge `Đã áp dụng` (không reload trang).
  - Khi phát hiện việc đã hoàn thành liên kết với suggestion mà user chưa phản hồi: tự mở bottom sheet nhắc đánh giá.
- Menu Admin (mobile + desktop)
  - Mobile: giữ nút `Menu` + `+ Thêm`.
  - Desktop: thêm nút `Menu` mở sidepanel giống mobile, có search + nhóm tính năng thu gọn/mở rộng.
  - Gom nhóm menu theo: `Tổng quan`, `Khách & Tư vấn`, `Học viên & Lịch`, `Tài chính`, `Tự động hoá`, `Quản trị`.

## 3) API endpoints mới/đổi + sample curl
### 3.1 `POST /api/tasks` (mở rộng)
- Thêm field hỗ trợ từ Trợ lý công việc:
  - `type`: `TASK | REMINDER | CALL_LIST`
  - `suggestionId` (optional)
  - `actionKey` (optional)
- Tự ghi `payload` chuẩn hóa (taskType, suggestionId, actionKey, createdById, fromAssistant).
- Tự ghi `AutomationLog` kiểu `ai-apply` khi tạo việc thành công.

Ví dụ:
```bash
curl -sS -X POST http://127.0.0.1:3000/api/tasks \
  -H 'Authorization: Bearer REDACTED' \
  -H 'Content-Type: application/json' \
  -d '{
    "title":"Gọi lại khách hẹn",
    "message":"Ưu tiên xử lý trước 16h",
    "scope":"FOLLOWUP",
    "priority":"HIGH",
    "type":"TASK",
    "suggestionId":"REDACTED_SUGGESTION_ID",
    "actionKey":"CREATE_TASK"
  }'
```

### 3.2 `GET /api/tasks` (mở rộng)
- Thêm filter `suggestionId` để tìm việc liên kết 1 gợi ý.

Ví dụ:
```bash
curl -sS 'http://127.0.0.1:3000/api/tasks?status=DONE&suggestionId=REDACTED_SUGGESTION_ID&page=1&pageSize=20' \
  -H 'Authorization: Bearer REDACTED'
```

### 3.3 `POST /api/outbound/jobs` (mở rộng)
- Giữ hành vi cũ tạo danh sách gọi nhắc.
- Bổ sung ghi `AutomationLog` kiểu `ai-apply` (payload có `suggestionId`, `actionKey`, `createdById`).

Ví dụ:
```bash
curl -sS -X POST http://127.0.0.1:3000/api/outbound/jobs \
  -H 'Authorization: Bearer REDACTED' \
  -H 'Idempotency-Key: REDACTED-UUID' \
  -H 'Content-Type: application/json' \
  -d '{
    "channel":"CALL_NOTE",
    "templateKey":"remind_schedule",
    "leadId":"REDACTED_LEAD",
    "suggestionId":"REDACTED_SUGGESTION_ID",
    "actionKey":"CREATE_CALL_LIST"
  }'
```

## 4) Cách test thủ công từng bước (local)
1. Chạy hệ thống local, đăng nhập tài khoản admin.
2. Mở `/ai/kpi-coach`.
3. Chọn 1 card có `actionsJson`, bấm `Áp dụng`.
4. Kiểm tra card hiện badge `Đã áp dụng`.
5. Với action tạo việc:
   - gọi `GET /api/tasks?status=NEW&suggestionId=<id>` để thấy việc mới.
6. Cập nhật việc sang hoàn thành ở luồng quản lý thông báo/việc.
7. Quay lại `/ai/kpi-coach` cùng ngày:
   - nếu suggestion đó chưa phản hồi thì bottom sheet đánh giá bật tự động.
8. Gửi phản hồi `Hữu ích` hoặc `Chưa đúng` và nhập lý do.
9. Kiểm tra card hiện `Đã phản hồi` và số liệu phản hồi tăng.
10. Mở `API Hub` tab `Luồng tự động (n8n)` để xem thêm luồng `W7`.

## 5) Những giả định/còn thiếu để đấu n8n sau
- `Task` hiện dùng model `Notification` làm lớp dữ liệu việc (không tạo bảng Task mới để tránh phá luồng cũ).
- `OutboundJob` hiện dùng endpoint tạo hàng đợi gọi nhắc qua `OutboundMessage`; chưa tách bảng job riêng.
- Nhắc đánh giá tự động đang dựa trên việc `DONE` có `payload.suggestionId`; chưa gắn realtime websocket.
- Cần n8n triển khai bước đọc feedback (`/api/ai/suggestions` + `/api/ai/suggestions/{id}/feedback`) để chấm lại chất lượng gợi ý theo tuần.

## Cập nhật API Hub
- Bổ sung mô tả luồng:
  - Tạo việc từ đề xuất
  - Tạo danh sách gọi từ đề xuất
  - Nhắc đánh giá khi hoàn thành
- Bổ sung workflow `W7` trong `src/lib/n8n-workflows.ts`.

## Verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma db seed`: PASS
