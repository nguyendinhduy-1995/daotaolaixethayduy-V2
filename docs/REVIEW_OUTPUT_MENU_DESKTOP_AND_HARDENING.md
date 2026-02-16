# REVIEW_OUTPUT_MENU_DESKTOP_AND_HARDENING

## Section A — Desktop menu UX mới
- Đã tách menu desktop thành component riêng: `src/components/admin/DesktopSidebarMenu.tsx`.
- Desktop dùng sidebar cố định bên trái (luôn nhìn thấy), có:
  - nhóm tính năng theo domain,
  - ô tìm kiếm nhanh,
  - highlight route đang mở,
  - thu gọn/mở rộng sidebar.
- Mobile giữ luồng cũ qua `MobileAdminMenu` (nút Menu + bottom sheet), không bị phá.

Ghi chú screenshot (mô tả):
1. Desktop `/dashboard`: sidebar cố định, group mở mặc định, item active sáng rõ.
2. Desktop sidebar thu gọn: hiển thị nhãn rút gọn + tooltip title.
3. Mobile `/ai/kpi-coach`: nút Menu nổi đáy vẫn hoạt động.

## Section B — Fixes A–E (before/after)

### A) Task-as-Notification hardening
Before:
- `/api/tasks` trả/ghi chung kiểu thông báo, chưa ép loại “Việc”.
- Query có thể lẫn dữ liệu không phải Task.

After:
- `/api/tasks` luôn ghi `payload.kind = 'TASK'`.
- `suggestionId` và `actionKey` được giữ trong payload chuẩn.
- `GET /api/tasks` chỉ query bản ghi có `payload.kind='TASK'`.

Files:
- `src/app/api/tasks/route.ts`

### B) Chuẩn hóa trạng thái việc
Before:
- Trạng thái lẫn giữa `DOING/SKIPPED` và cách gọi khác nhau trên UI/API.

After:
- API tasks dùng chuẩn hiển thị: `NEW | IN_PROGRESS | DONE | CANCELED`.
- Mapping tương thích dữ liệu cũ:
  - `DOING -> IN_PROGRESS`
  - `SKIPPED -> CANCELED`
  - Input vẫn nhận legacy (`DOING`, `SKIPPED`) để không vỡ client cũ.

Files:
- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[id]/route.ts`

### C) Thêm PATCH /api/tasks/[id]
Before:
- Chưa có endpoint chuẩn để đổi trạng thái việc sang DONE.

After:
- Có `PATCH /api/tasks/[id]` để cập nhật trạng thái.
- Trả kèm `suggestionId` nếu task liên kết gợi ý.
- Khi chuyển DONE, ghi `AutomationLog` theo style hiện có.

Files:
- `src/app/api/tasks/[id]/route.ts`
- `src/lib/route-permissions-map.ts` (map quyền PATCH)

### D) Feedback enforcement + re-prompt policy
Before:
- Prompt feedback chưa có giới hạn theo ngày cho mỗi suggestion.

After:
- Khi phát hiện task DONE có `suggestionId` và user chưa feedback:
  - mở bottom sheet nhắc đánh giá,
  - có nút `Để sau`.
- Re-prompt tối đa 1 lần/ngày/suggestion bằng localStorage.
- Server vẫn enforce 1 feedback/user/suggestion (đã có từ trước).

Files:
- `src/app/(app)/ai/kpi-coach/page.tsx`

### E) API Hub copy-paste wiring
Before:
- Card workflow chưa đủ block copy-paste cho headers/payload.

After:
- Mỗi workflow hiển thị:
  - danh sách endpoint,
  - headers mẫu,
  - payload JSON mẫu + nút sao chép.
- Bổ sung đầy đủ wiring cho W7 (apply -> task/call list -> feedback loop).

Files:
- `src/app/(app)/api-hub/page.tsx`
- `src/lib/n8n-workflows.ts`
- `src/lib/api-catalog.ts`

## Section C — Cleanup summary (an toàn, không đổi hành vi nghiệp vụ)
- Tách menu desktop ra component riêng để giảm duplication trong layout.
- Loại bỏ sidepanel desktop khỏi `MobileAdminMenu` để tránh chồng 2 hệ menu.
- Chuẩn hóa nhãn menu tiếng Việt đời thường trong `admin-menu` (ví dụ “Gọi nhắc”).
- Không đổi luồng nghiệp vụ cốt lõi hoặc contract API cũ theo hướng breaking.

## Section D — Manual test checklist

### Desktop menu
1. Mở `/dashboard` trên desktop.
2. Xác nhận sidebar trái luôn hiển thị, có group + tìm kiếm.
3. Bấm từng item, route active đổi đúng.
4. Bấm `Thu gọn`, sidebar chuyển mode rút gọn.

### Apply -> done -> feedback
1. Mở `/ai/kpi-coach`.
2. Chọn card có action, bấm `Áp dụng`.
3. Xác nhận card hiện badge `Đã áp dụng`.
4. Gọi `GET /api/tasks?suggestionId=<id>&status=NEW` thấy task mới.
5. Gọi `PATCH /api/tasks/<taskId>` với status `DONE`.
6. Quay lại `/ai/kpi-coach`, thấy bottom sheet nhắc feedback (nếu chưa feedback).
7. Bấm `Để sau`, reload trang cùng ngày -> không nhắc lại quá 1 lần/ngày/suggestion.
8. Gửi feedback `Hữu ích` hoặc `Chưa đúng` -> card hiển thị `Đã phản hồi`.

### API Hub
1. Mở `/api-hub`, chuyển tab `Luồng tự động (n8n)`.
2. Kiểm tra workflow W7 có endpoints + headers + payload mẫu + nút sao chép.

## Section E — API Hub workflow copy-paste examples

### Tạo việc từ đề xuất
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

### Tạo danh sách gọi từ đề xuất
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

### Đổi trạng thái việc sang DONE
```bash
curl -sS -X PATCH http://127.0.0.1:3000/api/tasks/REDACTED_TASK_ID \
  -H 'Authorization: Bearer REDACTED' \
  -H 'Content-Type: application/json' \
  -d '{"status":"DONE"}'
```

### Gửi phản hồi
```bash
curl -sS -X POST http://127.0.0.1:3000/api/ai/suggestions/REDACTED_SUGGESTION_ID/feedback \
  -H 'Authorization: Bearer REDACTED' \
  -H 'Content-Type: application/json' \
  -d '{"feedbackType":"HELPFUL","reason":"de_lam_theo"}'
```

## Section F — Files changed
- `src/components/admin/DesktopSidebarMenu.tsx`
- `src/app/(app)/layout.tsx`
- `src/components/mobile/MobileAdminMenu.tsx`
- `src/app/(app)/ai/kpi-coach/page.tsx`
- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[id]/route.ts`
- `src/app/api/outbound/jobs/route.ts`
- `src/lib/admin-menu.ts`
- `src/lib/route-permissions-map.ts`
- `src/lib/api-catalog.ts`
- `src/lib/n8n-workflows.ts`
- `prisma/migrations/20260217004000_ai_feedback_loop_required/migration.sql`

## Verify results
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma db seed`: PASS

## Exact routes to test
- `/dashboard`
- `/ai/kpi-coach`
- `/notifications`
- `/api-hub`
- `/admin/n8n`
