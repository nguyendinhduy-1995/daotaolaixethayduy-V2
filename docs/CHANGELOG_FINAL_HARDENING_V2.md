# CHANGELOG_FINAL_HARDENING_V2

## 1) P0 hardening đã thực hiện

### A. BranchId NOT NULL (2-phase)
- Thêm script backfill: `scripts/backfill-branch-id.mjs`.
- Tạo migration phase 1 (manual/no schema change):
  - `prisma/migrations/20260216232000_branch_backfill_phase1_manual/migration.sql`
- Tạo migration phase 2 (enforce NOT NULL + FK RESTRICT):
  - `prisma/migrations/20260216233000_branch_not_null_phase2/migration.sql`
- Chuẩn hóa schema `branchId` bắt buộc ở:
  - `Lead`, `Student`, `Receipt`, `CourseScheduleItem`, `AutomationLog`, `OutboundMessage`.

### B. Scope unify OWNER + BRANCH
- Cập nhật `src/lib/scope.ts`:
  - `getAllowedBranchIds`
  - `enforceBranchScope`
  - `whereBranchScope`
  - `whereOwnerScope`
  - `resolveWriteBranchId`
  - Chuẩn hóa `resolveScope`:
    - admin -> SYSTEM
    - manager -> BRANCH
    - telesales/direct_page -> OWNER + BRANCH
- Rà/fix các route chính dùng scope chuẩn:
  - `src/app/api/leads/route.ts`
  - `src/app/api/receipts/route.ts`
  - `src/app/api/schedule/route.ts`
  - `src/app/api/students/route.ts`
  - `src/app/api/outbound/messages/route.ts`
  - `src/app/api/automation/logs/route.ts`

### C. Idempotency policy
- Giữ model `IdempotencyRequest` với đầy đủ fields:
  - `key, route, actorType, actorId, requestHash, responseJson, statusCode, createdAt`.
- Cập nhật helper `src/lib/idempotency.ts`:
  - enforce key
  - replay response
  - conflict nếu payload khác
  - TTL cleanup 72h.
- Enforce cho POST create quan trọng:
  - `POST /api/receipts`
  - `POST /api/schedule`
  - `POST /api/outbound/dispatch`
  - `POST /api/insights/expenses/ingest`

### D. Ingest token rotation readiness
- `src/app/api/insights/expenses/ingest/route.ts`:
  - chấp nhận `SERVICE_TOKEN_ACTIVE` hoặc `SERVICE_TOKEN_NEXT` (fallback legacy)
  - bắt buộc `source='n8n'` + `runId`
  - lưu `payloadHash`
  - rate-limit nhẹ in-memory.

### E. E2E local harness
- Thêm script:
  - `test:e2e:local` trong `package.json`.
- Cập nhật runner:
  - `scripts/run-e2e.mjs` nhận test args.
- Thêm test tối thiểu:
  - `tests/hardening-v2.spec.ts`

## 2) Files changed (chính)
- `prisma/schema.prisma`
- `prisma/migrations/20260216232000_branch_backfill_phase1_manual/migration.sql`
- `prisma/migrations/20260216233000_branch_not_null_phase2/migration.sql`
- `scripts/backfill-branch-id.mjs`
- `src/lib/scope.ts`
- `src/lib/idempotency.ts`
- `src/app/api/receipts/route.ts`
- `src/app/api/schedule/route.ts`
- `src/app/api/outbound/dispatch/route.ts`
- `src/app/api/insights/expenses/ingest/route.ts`
- `src/app/api/outbound/messages/route.ts`
- `src/app/api/automation/logs/route.ts`
- `src/app/api/leads/route.ts`
- `src/app/api/students/route.ts`
- `src/lib/services/outbound-worker.ts`
- `src/lib/services/cron-daily.ts`
- `src/app/api/automation/run/route.ts`
- `src/app/api/courses/[id]/schedule/route.ts`
- `src/lib/api-catalog.ts`
- `API_INTEGRATION_SPEC.md`
- `FEATURE_MAP_AND_RUNBOOK.md`
- `RUNBOOK_LOCAL.md`
- `REVIEW_PACKET.md`
- `tests/hardening-v2.spec.ts`
- `package.json`

## 3) Kết quả verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run verify`: PASS
- `npx prisma migrate reset --force`: PASS
- `npx prisma db seed`: PASS
- `npm run test:e2e:local`: FAIL (best-effort) do môi trường sandbox chặn Turbopack/process bind (`Operation not permitted`).
