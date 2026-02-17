# TEST_CHECKLIST_AI_KPI_COACH

## 1) Auth & page load
- [ ] Đăng nhập `Nguyendinhduy / Nguyendinhduy@95` thành công.
- [ ] Mở `/ai/kpi-coach` không bị spinner vô hạn.
- [ ] Mở `/kpi/targets` và `/goals` tải dữ liệu được.
- [ ] Mở `/kpi/daily` thấy chỉ số hiển thị dạng phần trăm (%), không còn KPI số lượng.

## 2) KPI Targets
- [ ] `GET /api/kpi/targets` trả danh sách theo scope.
- [ ] `POST /api/kpi/targets` upsert thành công.
- [ ] Tạo target theo vai trò (`ownerId = null`) thành công.
- [ ] Tạo target theo nhân sự (`ownerId != null`) thành công.
- [ ] Nhập chỉ số sai vai trò trả `400` + message tiếng Việt.
- [ ] Nhập mục tiêu ngoài khoảng `0..100` trả lỗi tiếng Việt.
- [ ] Refresh page thấy target đã cập nhật.

## 3) Goals daily + monthly
- [ ] `POST /api/goals` với `periodType=DAILY` thành công.
- [ ] `POST /api/goals` với `periodType=MONTHLY` thành công.
- [ ] `GET /api/goals` trả đúng theo bộ lọc kỳ.

## 4) AI Suggestions
- [ ] `POST /api/ai/suggestions/ingest` có `x-service-token` + `Idempotency-Key` => 200.
- [ ] Bỏ token hoặc sai token => 403.
- [ ] Mở `/ai/kpi-coach` thấy suggestion mới ingest.
- [ ] `POST /api/ai/suggestions/{id}/feedback` lưu feedback thành công.
- [ ] UI hiển thị tiếng Việt đời thường: `data có số`, `lịch hẹn`, `khách đến`, `khách ký`.

## 5) Danh sách gọi từ action
- [ ] Bấm `Tạo danh sách gọi` trên card suggestion.
- [ ] API `/api/outbound/jobs` trả `outboundMessage.status=QUEUED`.
- [ ] Người dùng ngoài scope không tạo được (403).

## 6) Dashboard widget
- [ ] Dashboard hiển thị widget `Trợ lý công việc hôm nay`.
- [ ] Bấm link điều hướng qua `/ai/kpi-coach`.

## 7) Verify kỹ thuật
- [ ] `npm run lint` PASS.
- [ ] `npm run build` PASS.
- [ ] `npm run verify` PASS.
- [ ] `npx prisma migrate reset --force` PASS.
- [ ] `npx prisma db seed` PASS.
