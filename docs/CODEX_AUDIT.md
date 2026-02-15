# CODEX AUDIT - THAYDUY CRM

## Status
- Đã fix:
  - Admin UI gate không còn trust JWT decode-only, đã verify qua `/api/auth/me` trước khi vào `/admin/*`.
  - Auth error code đã chuẩn hóa theo `AUTH_MISSING_BEARER` / `AUTH_INVALID_TOKEN` trên auth routes chính.
  - Marketing đã hợp nhất pipeline về `MarketingReport`; endpoint cũ `ingest/metrics` chuyển sang adapter deprecated.
  - `LeadEvent.type` đã chuyển sang enum DB-level + migration map legacy an toàn.
  - `/api/automation/logs` đã filter/paging ở DB, bỏ full scan in-memory.
  - `resolveBranchId` đã map theo `Branch.code`.
  - OpsPulse đã có idempotency unique theo bucket thời gian + scope.
  - UI auth gating đã gom về shared guard theo `/api/auth/me`.
- Follow-up còn lại:
  - Dọn hẳn pipeline Marketing legacy (`marketing-metrics`/`MarketingMetric`) sau giai đoạn tương thích ngược.
  - Chuẩn hóa message API tiếng Việt đồng nhất ở các route còn trả English text.
  - Mở rộng áp dụng shared mobile admin pattern trên toàn bộ màn (một số màn đã dùng, một số còn mixed).

## 1) Tóm tắt kiến trúc hiện tại
- Stack: Next.js App Router (`src/app`), Prisma + PostgreSQL, Redis (ops/queue), verify qua `scripts/verify.sh`.
- Auth nội bộ:
  - Session cookie (`access_token`, `refresh_token`) + fallback Bearer.
  - API auth helper: `src/lib/auth.ts`, `src/lib/route-auth.ts`.
  - Middleware route protection: `middleware.ts` (chặn route UI, role check `/admin/*`).
- Auth học viên:
  - Cookie riêng `student_access_token`, API ở `src/app/api/student/*`.
- RBAC/owner scope:
  - Admin thấy full data.
  - Telesales scope theo `ownerId` ở nhiều module (`leads/students/receipts/notifications/outbound/...`).
- Scheduler/n8n ingest:
  - Cron secret endpoint: `/api/cron/daily` (`x-cron-secret`).
  - Worker secret endpoint: `/api/worker/outbound` (`x-worker-secret`).
  - Callback outbound: `/api/outbound/callback` (`x-callback-secret`).
  - Ops Pulse ingest: `/api/ops/pulse` (`x-ops-secret`).
  - Marketing ingest: pipeline chính `MarketingReport`; endpoint legacy vẫn chạy dạng adapter để tương thích ngược.
- Module nghiệp vụ chính:
  - Leads + events + assign/auto-assign.
  - KPI daily.
  - Students/Courses/Schedule + attendance.
  - Receipts/finance.
  - Notifications + outbound queue/dispatch/callback.
  - Automation logs.
  - Marketing.
  - HR/Payroll/Commission.

## 2) Điểm làm tốt (good practices)
- Có chuẩn lỗi JSON thống nhất (`jsonError`) và đa số route dùng nhất quán.
- Tách helper auth/role rõ (`requireRouteAuth`, `requireAdminRole`, `isAdminRole`, `isTelesalesRole`).
- Secret-based endpoint cho cron/worker/ingest/callback tách khỏi session user.
- Outbound queue có retry/backoff + lease fields (`leaseId`, `leaseExpiresAt`, `nextAttemptAt`) trong schema.
- Kiểm soát owner-scope khá rộng trong các module nhạy cảm:
  - Leads/students/receipts/outbound/notifications có filter owner tương đối đầy đủ.
- Verify script bao phủ nhiều flow quan trọng (auth, cron, worker, outbound callback, marketing, ops).

## 3) Rủi ro/bug tiềm ẩn + bằng chứng

### P0/P1 đã xử lý
1. Middleware chỉ decode JWT, không verify chữ ký. (`DONE`)
- Bằng chứng: `middleware.ts:27-37`, `middleware.ts:68-76`.
- Trạng thái: đã chuyển sang verify `/api/auth/me` cho `/admin/*`; verify script có test forged token.

2. Mã lỗi auth không đồng nhất giữa API và frontend handling. (`DONE`)
- Bằng chứng:
  - `src/app/api/auth/me/route.ts:14,24` trả `UNAUTHORIZED`.
  - Client thường bắt `AUTH_MISSING_BEARER`/`AUTH_INVALID_TOKEN` để logout (`src/lib/api-client.ts`, nhiều page trong `src/app/(app)/*`).
- Trạng thái: đã chuẩn hóa về `AUTH_INVALID_TOKEN`.

3. Marketing có 2 hệ endpoint/service song song, dễ drift dữ liệu và contract. (`PARTIAL`)
- Bằng chứng:
  - Luồng A: `src/lib/services/marketing.ts`, `/api/marketing/report`, `/api/admin/marketing/report`, `/api/admin/marketing/reports`.
  - Luồng B: `src/lib/services/marketing-metrics.ts`, `/api/marketing/ingest`, `/api/marketing/metrics`, `/api/admin/marketing/ingest`.
  - Schema có cả `MarketingReport` và `MarketingMetric` (`prisma/schema.prisma:547`, `prisma/schema.prisma:698`).
- Trạng thái: endpoint legacy đã adapter về `MarketingReport`; còn follow-up remove hẳn legacy model/service.

4. `LeadEvent.type` là string tự do, không enum DB-level. (`DONE`)
- Bằng chứng: `prisma/schema.prisma:261-275`.
- Trạng thái: đã chuyển enum + migration map legacy -> `OTHER`.

5. `/api/automation/logs` lọc status ở memory sau khi query toàn bộ. (`DONE`)
- Bằng chứng: `src/app/api/automation/logs/route.ts:89-106`.
- Trạng thái: đã lọc/paging ở DB query.

### P2 còn lại
6. `resolveBranchId` map `branchCode` theo `Branch.name`, không theo `code`. (`DONE`)
- Bằng chứng: `src/lib/services/marketing.ts:61-66`.
- Trạng thái: đã sửa dùng `Branch.code`.

7. OpsPulse idempotency chưa có unique constraint cứng theo bucket 10 phút. (`DONE`)
- Bằng chứng: `prisma/schema.prisma:718-734` chỉ có index, không có unique key bucket.
- Trạng thái: đã thêm unique composite + upsert theo bucket.

8. Một số response/auth code còn lẫn tiếng Anh ở API message.
- Bằng chứng: nhiều `jsonError(..., "Forbidden"|"Unauthorized"|"Internal server error")`.
- Tác động: UX tiếng Việt chưa đồng nhất hoàn toàn ở frontend khi pass-through message.

## 4) TODO ưu tiên (P0/P1/P2) + ước lượng

### Còn mở
1. Hợp nhất triệt để Marketing:
- Xóa dần `marketing-metrics` service/model sau giai đoạn tương thích ngược.
- Độ khó: M-L.

2. Chuẩn hóa API message tiếng Việt theo code:
- Ưu tiên route auth/security/validation phổ biến.
- Độ khó: S-M.

3. Hoàn thiện áp dụng shared mobile admin pattern cho các màn còn mixed UI.
- Độ khó: M.

## 5) Đề xuất chuẩn hóa UI admin mobile
- Layout:
  - Dùng pattern cố định: `MobileTopbar` + `MobileBottomNav` + `MobileFiltersSheet`.
  - Mọi list page mobile dùng card list, desktop giữ table.
- Data states chuẩn:
  - Loading: skeleton 3-5 card.
  - Empty: icon + “Không có dữ liệu” + CTA “Làm mới”.
  - Error: alert tiếng Việt + nút “Thử lại”.
- Filter UX:
  - Thanh nhanh chỉ giữ `q` + nút “Bộ lọc”.
  - Filter nâng cao trong bottom sheet có footer sticky (Huỷ/Áp dụng/Xóa lọc).
- Action UX:
  - Row/card action chính 1 nút.
  - Action phụ gom vào menu `...`/sheet.
- Accessibility/perf:
  - Tap target >= 44px, focus ring rõ.
  - Tránh render list rất dài không phân trang/tải thêm.
  - Giảm re-render filter bằng debounce 250-300ms.

## 6) Checklist hành động đề xuất (theo thứ tự)
1. Chốt kế hoạch remove legacy Marketing (`MarketingMetric`) và migration dữ liệu nếu cần.
2. Chuẩn hóa message/API error text theo tiếng Việt nhất quán.
3. Rà soát toàn bộ admin pages để áp dụng full shared mobile pattern.
