# REVIEW OUTPUT LEVEL 2 AI SKELETON

## 0) Files thay đổi chính
- `src/lib/services/ai-kpi-coach.ts`
- `src/app/(app)/ai/kpi-coach/page.tsx`
- `src/app/api/outbound/jobs/route.ts`
- `src/app/api/outbound/jobs/[id]/route.ts`
- `src/app/api/automation/logs/ingest/route.ts`
- `src/lib/n8n-workflows.ts`
- `src/app/(app)/api-hub/page.tsx`
- `src/lib/api-catalog.ts`
- `src/lib/route-permissions-map.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260217005000_level2_outbound_jobs/migration.sql`
- `docs/REVIEW_OUTPUT_LEVEL2_AI_SKELETON.md`

## 1) Đã thay đổi gì và vì sao
- Mở rộng `Trợ lý công việc` theo nhiều module bằng luật cố định (không gọi AI trực tiếp trong app): KPI, Khách hàng, Thu tiền/công nợ, Chi phí, Lịch học.
- Mỗi gợi ý đều có `actionsJson` để người dùng bấm `Áp dụng` và có `n8nNotes` mô tả rõ cách nối n8n ở bước sau.
- Chuẩn hóa hợp đồng `Danh sách gọi` mức Level 2 bằng model `OutboundJob` + trạng thái `NEW|DISPATCHED|DONE|FAILED`.
- Bổ sung endpoint service-token cho n8n cập nhật trạng thái job và ingest nhật ký tự động hóa.
- Nâng API Hub phần `Luồng tự động (n8n)` để hiển thị `Ghi chú n8n` dạng từng bước thao tác node.

## 2) Endpoint mới/chỉnh sửa + ví dụ curl
- `PATCH /api/outbound/jobs/:id`
  - Mục đích: n8n cập nhật trạng thái job gọi nhắc.
  - Header bắt buộc: `x-service-token`, `Idempotency-Key`.
  - Ví dụ:
```bash
curl -sS -X PATCH http://localhost:3000/api/outbound/jobs/REDACTED_JOB_ID \
  -H 'x-service-token: REDACTED' \
  -H 'Idempotency-Key: REDACTED-UUID' \
  -H 'Content-Type: application/json' \
  -d '{"status":"DONE","runId":"run-2026-02-16-01"}'
```

- `POST /api/automation/logs/ingest`
  - Mục đích: n8n đẩy log vận hành vào CRM.
  - Header bắt buộc: `x-service-token`, `Idempotency-Key`.
  - Ví dụ:
```bash
curl -sS -X POST http://localhost:3000/api/automation/logs/ingest \
  -H 'x-service-token: REDACTED' \
  -H 'Idempotency-Key: REDACTED-UUID' \
  -H 'Content-Type: application/json' \
  -d '{"branchId":"REDACTED_BRANCH","channel":"n8n","status":"sent","milestone":"w7.apply","payload":{"runId":"run-2026-02-16-01"}}'
```

- `GET /api/ai/suggestions`
  - Bổ sung dữ liệu trả về: `n8nNotes` cho từng suggestion.

## 3) Danh sách workflow notes mới
- W7: Áp dụng đề xuất -> Gửi đi -> Hoàn tất -> Phản hồi.
- W8: Nhắc việc theo lịch và việc đến hạn.
- W9: Nhắc thu tiền/công nợ đến hạn.
- W10: Cảnh báo chi phí vượt ngưỡng.
- W11: Nhắc lịch học và rủi ro gần ngày thi.

## 4) Checklist test thủ công
1. Mở `/api-hub` -> tab `Luồng tự động (n8n)` -> kiểm tra từng workflow có mục thu gọn `Ghi chú n8n`.
2. Mở `/ai/kpi-coach` -> kiểm tra có thêm gợi ý theo module khác (khách hàng, thu tiền, chi phí, lịch học).
3. Bấm `Áp dụng` trên card có action `CREATE_OUTBOUND_JOB` -> kiểm tra tạo được record tại `/api/outbound/jobs`.
4. Gọi `PATCH /api/outbound/jobs/:id` bằng service token -> kiểm tra trạng thái job đổi đúng.
5. Gọi `POST /api/automation/logs/ingest` -> kiểm tra có log mới trong `/api/automation/logs`.

## 5) Safe cleanup đã làm
- Quét các file liên quan Level 2 để tránh trùng mapping endpoint và trùng định nghĩa action type.
- Không xoá module cũ ngoài phạm vi vì repo đang có nhiều thay đổi dở dang từ các vòng trước; giữ nguyên hành vi hiện hữu để giảm rủi ro regression.

## 6) Kết quả verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `npx prisma migrate reset --force`: PASS (đã áp dụng toàn bộ migration, gồm `20260217005000_level2_outbound_jobs`)
- `npx prisma db seed`: PASS (seed deterministic hoàn tất)
\nGhi chú:
- Có warning không chặn kết quả về `MODULE_TYPELESS_PACKAGE_JSON` khi chạy script TypeScript bằng `ts-node --transpile-only`.
