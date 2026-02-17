# CHANGELOG_AI_FEEDBACK

## Tổng quan
Triển khai vòng phản hồi bắt buộc cho mọi đề xuất ở trang **Trợ lý công việc**: người dùng bắt buộc chọn loại phản hồi + lý do, CRM lưu phản hồi theo từng người, và dữ liệu phản hồi sẵn sàng cho n8n học dần.

## Files changed
- `prisma/schema.prisma`
  - Thêm module quyền `ai_suggestions` và action `FEEDBACK`.
  - Thêm enum `AiSuggestionFeedbackType`.
  - Mở rộng `AiSuggestionFeedback` với `feedbackType`, `reason`, `reasonDetail`, `actualResult`.
  - Thêm unique `@@unique([suggestionId, userId])`.
- `prisma/migrations/20260216102342_ai_feedback_loop_required/migration.sql`
  - Tạo enum mới, thêm cột mới, thêm unique/index.
  - Backfill dữ liệu feedback cũ sang cấu trúc mới.
- `src/lib/permission-keys.ts`
  - Bổ sung module `ai_suggestions`, action `FEEDBACK`.
- `src/lib/permissions.ts`
  - Cấp quyền mặc định cho `ai_suggestions` theo từng role.
- `src/lib/route-permissions-map.ts`
  - Map route AI suggestions sang `ai_suggestions`.
  - Route feedback dùng action `FEEDBACK`.
- `src/lib/ui-permissions.ts`
  - Ánh xạ UI `/ai/kpi-coach` và `/admin/huong-dan-ai` sang module `ai_suggestions`.
  - Hỗ trợ action `FEEDBACK`.
- `src/lib/services/ai-kpi-coach.ts`
  - `listAiSuggestions` trả thêm `feedbackStats` và `myFeedback`.
  - `addAiSuggestionFeedback` validate đầy đủ body, enforce một phản hồi mỗi user/suggestion.
  - Bắt lỗi race-condition unique và trả lỗi tiếng Việt rõ ràng.
- `src/app/api/ai/suggestions/[id]/feedback/route.ts`
  - Parse body mới (`feedbackType`, `reason`, `reasonDetail`, `actualResult`, `note`).
  - Enforce thêm điều kiện user phải có quyền `ai_suggestions:VIEW`.
- `src/app/(app)/ai/kpi-coach/page.tsx`
  - Thêm 3 nút phản hồi: `Hữu ích`, `Không hữu ích`, `Đã làm xong`.
  - Mở bottom sheet để nhập lý do/ghi chú/kết quả thực tế.
  - Nếu chọn `Khác` bắt buộc nhập lý do cụ thể.
  - Cập nhật UI ngay sau khi gửi: badge `Đã phản hồi` + disable nút, không reload toàn trang.
- `src/app/(app)/admin/phan-quyen/page.tsx`
  - Bổ sung nhãn action `FEEDBACK`.
- `src/lib/api-catalog.ts`
  - Cập nhật contract API AI suggestions + feedback theo schema mới.
- `docs/AI_AUTOMATION_MASTERPLAN.md`
  - Bổ sung mục “Vòng phản hồi bắt buộc”.
- `docs/IMPLEMENTATION_REPORT.md`
  - Cập nhật phạm vi triển khai và kết quả verify cho vòng phản hồi.

## Cách test thủ công
1. Đăng nhập tài khoản có quyền xem `Trợ lý công việc`.
2. Mở `/ai/kpi-coach` và chọn ngày có suggestions.
3. Chọn một card, bấm `Hữu ích` hoặc `Không hữu ích` hoặc `Đã làm xong`.
4. Trong bottom sheet:
   - Chọn `Lý do`.
   - Nếu chọn `Khác`, thử để trống lý do cụ thể để thấy validate.
   - Nhập `Ghi chú` và số liệu thực tế (`data`, `hẹn`, `đến`, `ký`) nếu muốn.
5. Bấm `Gửi phản hồi`.
6. Kiểm tra ngay trên card:
   - Hiện badge `Đã phản hồi`.
   - 3 nút phản hồi bị khóa.
   - Số đếm thống kê phản hồi tăng ngay.
7. Thử gửi lần 2 cùng suggestion bằng cùng user (qua UI hoặc API) -> nhận lỗi `Bạn đã phản hồi gợi ý này`.

## Verify commands
- `npm run lint` ✅
- `npm run build` ✅
- `npx prisma migrate dev --name ai_feedback_loop_required` ✅
- `npx prisma db seed` ✅
