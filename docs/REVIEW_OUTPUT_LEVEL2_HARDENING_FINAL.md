# REVIEW OUTPUT LEVEL 2 HARDENING FINAL

## 1) What changed

### 1.1 Chuẩn hóa service token
- Dùng một biến môi trường duy nhất: `SERVICE_TOKEN`.
- Tạo helper dùng chung: `src/lib/service-token.ts`.
- Áp dụng đồng nhất cho các route ingest/service:
  - `POST /api/ai/suggestions/ingest`
  - `POST /api/insights/expenses/ingest`
  - `POST /api/automation/logs/ingest`
  - `PATCH /api/outbound/jobs/:id`
- Lỗi trả về JSON tiếng Việt:
  - Thiếu token: `AUTH_MISSING_SERVICE_TOKEN` - "Thiếu token dịch vụ"
  - Token sai: `AUTH_INVALID_SERVICE_TOKEN` - "Token dịch vụ không hợp lệ"

### 1.2 Hardening idempotency cho ingest/update
- Bắt buộc `Idempotency-Key` trên:
  - `PATCH /api/outbound/jobs/:id`
  - `POST /api/automation/logs/ingest`
- Dùng `withIdempotency(...)` (bảng `IdempotencyRequest`) để:
  - key trùng + payload trùng => trả lại response cũ (200/đúng status cũ), không tạo record trùng.
  - key trùng + payload khác => trả conflict như hiện trạng hệ thống.

### 1.3 OutboundJob contract cứng hơn
- `OutboundJob` bổ sung:
  - `metaJson` chứa tối thiểu: `branchId`, `ownerId`, `suggestionId`, `actionKey`.
  - `taskId` (nullable) liên kết task theo dõi.
- Khi tạo `POST /api/outbound/jobs`:
  - nếu không truyền `taskId`, hệ thống tự tạo task theo dõi và gắn `taskId`.
  - `metaJson` có thêm `toPhone`/`messageText` khi dữ liệu có sẵn.

### 1.4 Link OutboundJob -> Task và auto-close
- Khi `PATCH /api/outbound/jobs/:id` cập nhật `DONE`:
  - nếu `taskId` tồn tại thì tự động cập nhật task về `DONE` phía server.
  - ghi `AutomationLog` kèm `taskId`, `suggestionId`, `runId`, trạng thái.

### 1.5 Nâng notes n8n để đấu nối dễ hơn
- `src/lib/n8n-workflows.ts` bổ sung cho mỗi workflow:
  - `definitionOfDone`
  - `failConditions`
  - `retryPolicy`
- `src/app/(app)/api-hub/page.tsx` hiển thị thêm 3 khối trên dưới dạng section thu gọn.

---

## 2) Endpoints + curl mẫu

### 2.1 PATCH /api/outbound/jobs/:id
- Auth: `x-service-token: SERVICE_TOKEN`
- Header bắt buộc: `Idempotency-Key`

```bash
curl -sS -X PATCH http://localhost:3000/api/outbound/jobs/REDACTED_JOB_ID \
  -H 'x-service-token: REDACTED' \
  -H 'Idempotency-Key: REDACTED-UUID' \
  -H 'Content-Type: application/json' \
  -d '{"status":"DONE","runId":"run-2026-02-16-01","lastError":null}'
```

### 2.2 POST /api/automation/logs/ingest
- Auth: `x-service-token: SERVICE_TOKEN`
- Header bắt buộc: `Idempotency-Key`

```bash
curl -sS -X POST http://localhost:3000/api/automation/logs/ingest \
  -H 'x-service-token: REDACTED' \
  -H 'Idempotency-Key: REDACTED-UUID' \
  -H 'Content-Type: application/json' \
  -d '{"branchId":"REDACTED_BRANCH","channel":"n8n","status":"sent","milestone":"w7.apply","payload":{"runId":"run-2026-02-16-01"}}'
```

### 2.3 POST /api/outbound/jobs (contract cập nhật)

```bash
curl -sS -X POST http://localhost:3000/api/outbound/jobs \
  -H 'Authorization: Bearer REDACTED' \
  -H 'Idempotency-Key: REDACTED-UUID' \
  -H 'Content-Type: application/json' \
  -d '{"channel":"CALL_NOTE","templateKey":"remind_schedule","leadId":"REDACTED_LEAD","suggestionId":"REDACTED_SUGGESTION_ID","actionKey":"CREATE_OUTBOUND_JOB"}'
```

---

## 3) DB changes / migrations

### 3.1 Prisma schema
- `OutboundJob`
  - thêm `metaJson Json?`
  - thêm `taskId String?`
  - thêm relation `task -> Notification`
  - thêm index `@@index([taskId, createdAt])`
- `Notification`
  - thêm relation ngược `outboundJobs OutboundJob[]`

### 3.2 Migration mới
- `prisma/migrations/20260217006000_level2_outbound_job_task_meta/migration.sql`
  - add columns `metaJson`, `taskId`
  - add index `OutboundJob_taskId_createdAt_idx`
  - add FK `OutboundJob_taskId_fkey` -> `Notification(id)`
- `prisma/migrations/20260217006100_outbound_message_status_created_idx/migration.sql`
  - align index `OutboundMessage_status_createdAt_idx` để pass schema gate

---

## 4) Manual test checklist

1. Mở `/api-hub` -> tab `Luồng tự động (n8n)`:
- Mỗi workflow có thêm khối `Điều kiện hoàn tất`, `Điều kiện lỗi`, `Chính sách thử lại`.

2. Tạo outbound job từ UI Trợ lý công việc:
- Kiểm tra bản ghi `OutboundJob` có `metaJson` và `taskId`.

3. Gọi `PATCH /api/outbound/jobs/:id` với trạng thái `DONE`:
- Kiểm tra `OutboundJob.status = DONE`.
- Nếu có `taskId`, task liên kết chuyển `DONE`.
- Có `AutomationLog` milestone `outbound-job-status`.

4. Gọi `POST /api/automation/logs/ingest` 2 lần cùng `Idempotency-Key` + payload:
- Kỳ vọng không tạo log trùng, response lần 2 giống lần 1.

5. Gọi endpoint ingest không gửi token hoặc token sai:
- Kỳ vọng lỗi JSON tiếng Việt đúng code.

---

## 5) Verify results

- `npm run lint`: **PASS**
- `npm run build`: **PASS**
- `npm run verify`: **PASS**
- `npx prisma migrate reset --force`: **PASS**
- `npx prisma db seed`: **PASS**

Ghi chú:
- Có warning `MODULE_TYPELESS_PACKAGE_JSON` từ `ts-node --transpile-only`, không chặn build/verify.

---

## 6) Files touched (trực tiếp theo scope hardening)
- `src/lib/service-token.ts`
- `src/app/api/ai/suggestions/ingest/route.ts`
- `src/app/api/insights/expenses/ingest/route.ts`
- `src/app/api/automation/logs/ingest/route.ts`
- `src/app/api/outbound/jobs/route.ts`
- `src/app/api/outbound/jobs/[id]/route.ts`
- `src/lib/n8n-workflows.ts`
- `src/app/(app)/api-hub/page.tsx`
- `src/lib/api-catalog.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260217006000_level2_outbound_job_task_meta/migration.sql`
- `prisma/migrations/20260217006100_outbound_message_status_created_idx/migration.sql`
- `.env.example`
- `API_INTEGRATION_SPEC.md`
- `FEATURE_MAP_AND_RUNBOOK.md`
- `REVIEW_PACKET.md`
- `docs/REVIEW_OUTPUT_LEVEL2_HARDENING_FINAL.md`
