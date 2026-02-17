# FIX_LOG

## Mục tiêu đợt fix
- Ổn định local runtime trên macOS.
- Loại bỏ lỗi migration Prisma trên DB sạch/shadow.
- Chuẩn hóa runbook và script vận hành.

## File changed + lý do

1. `docker-compose.yml`
- Đổi cổng host Postgres `5432` -> `5433` để tránh conflict local.
- Đổi cổng host Redis `6379` -> `6380` để tránh conflict local.

2. `.env.example`
- Cập nhật `DATABASE_URL` sang `localhost:5433`.
- Cập nhật `REDIS_URL` sang `localhost:6380`.

3. `.env`
- Cập nhật `DATABASE_URL` sang `localhost:5433`.

4. `prisma/migrations/20260214210000_outbound_worker_lease/migration.sql`
- Bổ sung SQL idempotent để tự tạo enum/bảng `OutboundMessage` nếu thiếu trước khi `ALTER TABLE`.
- Bổ sung FK/index `IF NOT EXISTS` / safe block để migrate chạy sạch trên DB mới/shadow.

5. `prisma/migrations/20260216180000_outbound_message_alignment/migration.sql` (mới)
- Migration forward-only để chuẩn hóa production schema cho `OutboundMessage` và thực thể liên quan:
  - Đảm bảo enums: `Outbound*`, `Notification*`.
  - Đảm bảo tables: `NotificationRule`, `MessageTemplate`, `Notification`, `OutboundMessage`.
  - Đảm bảo FK/index/defaults quan trọng theo `schema.prisma`.
- Mục tiêu: không còn phụ thuộc vào “hack tạo bảng tối thiểu” trong migration lease để đạt trạng thái schema đúng cuối chuỗi.

6. `package.json`
- Thêm script `db:reset` = `prisma migrate reset --force`.

7. `AUDIT_REPORT.md`
- Báo cáo audit theo mức độ P0/P1/P2 + nguyên nhân/hướng xử lý.

8. `RUNBOOK_LOCAL.md`
- Hướng dẫn chạy local từ zero + smoke check + debug lệnh thường gặp.

9. `REVIEW_PACKET.md`
- Cập nhật hướng dẫn DB/port và trạng thái verify mới nhất.

10. `PATCH_NOTES.md`
- Bổ sung phần nguyên nhân và fix migration Prisma P3006/P1014.

11. `src/lib/route-permissions-map.ts`
- Mở rộng public allowlist về dạng pattern:
  - `/api/health/*`
  - `/api/auth/*`
- Mục tiêu: không bị deny-by-default sai cho route public.

12. `src/lib/ui-auth-guard.ts`
- Chuẩn hóa guard result:
  - `401`/auth invalid -> về login.
  - `403` -> trả trạng thái forbidden (không redirect loop).
  - network/db/timeout -> trạng thái error.
- Thêm timeout 10 giây để tránh loading vô hạn.

13. `src/app/(app)/layout.tsx`
- Thêm UI fallback cho `403` và lỗi mạng:
  - Thông báo tiếng Việt.
  - Nút `Thử lại` và điều hướng phù hợp.

14. `scripts/check-schema.mjs`
- Bổ sung best-effort `docker compose up -d postgres` trước schema gate.

15. `scripts/verify-gate.mjs`
- Tạo pipeline verify chuẩn: `lint + build + audit:permissions + check:schema` (+ Playwright khi có `BASE_URL`).

16. `package.json`
- Cập nhật `verify` -> `node scripts/verify-gate.mjs`.

## Không thay đổi
- Không rewrite lịch sử migration cũ.
- Không thay đổi API contract hiện có.
