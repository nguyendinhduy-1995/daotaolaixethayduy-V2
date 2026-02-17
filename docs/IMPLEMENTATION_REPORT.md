# IMPLEMENTATION_REPORT

## Phạm vi triển khai
- Triển khai vòng phản hồi bắt buộc cho mọi gợi ý ở trang `Trợ lý công việc`.
- Chuẩn hóa API feedback:
  - `POST /api/ai/suggestions/[id]/feedback` có validate body rõ ràng.
  - Mỗi user chỉ phản hồi 1 lần cho 1 suggestion.
  - Kiểm tra quyền: phải có quyền xem gợi ý mới được phản hồi.
- Mở rộng dữ liệu trả về từ `GET /api/ai/suggestions`:
  - `feedbackStats`: tổng, hữu ích, không hữu ích, đã làm xong.
  - `myFeedback`: phản hồi của người đăng nhập.
- Cập nhật RBAC:
  - module `ai_suggestions`
  - action `FEEDBACK`
- Cập nhật Prisma:
  - `AiSuggestionFeedback` thêm `feedbackType`, `reason`, `reasonDetail`, `actualResult`.
  - unique `(suggestionId, userId)` để chặn gửi trùng.

## Kết quả verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npx prisma migrate dev --name ai_feedback_loop_required`: PASS
- `npx prisma db seed`: PASS
- `npx prisma generate`: PASS

## Ghi chú môi trường
- `prisma migrate dev` cần xác nhận tương tác khi thêm unique constraint.
- Trong terminal không có TTY, cần chạy với phiên có tương tác để trả lời xác nhận.

## Cách reproduce nhanh
1. `docker compose up -d`
2. `npx prisma migrate dev --name ai_feedback_loop_required`
3. `npx prisma generate`
4. `npx prisma db seed`
5. `npm run lint`
6. `npm run build`
