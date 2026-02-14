# thayduy-crm Runbook

Local-first runbook for Next.js 16 + Prisma 7 + Postgres + Redis.

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (or Docker Engine with `docker compose`)

## First-Time Setup

1. Copy environment file:
```bash
cp .env.example .env
```
2. Install dependencies:
```bash
npm install
```
3. Start local services (Postgres + Redis):
```bash
npm run db:up
```
4. Apply migrations:
```bash
npm run db:migrate
```
5. Generate Prisma client:
```bash
npm run prisma:generate
```
6. Seed admin user:
```bash
npm run db:seed
```

## Common Commands

- Start dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Prisma validate: `npm run prisma:validate`
- Prisma generate: `npm run prisma:generate`
- Migrate DB: `npm run db:migrate`
- Seed admin: `npm run db:seed`
- Bring DB/Redis up: `npm run db:up`
- Bring DB/Redis down: `npm run db:down`
- Full verification: `npm run verify`

## Verify Flow

`npm run verify` will:

1. Check `.env`
2. Run Prisma validate + generate
3. Run lint + build
4. Start dev server (or reuse existing one on port 3000)
5. Verify API routes with curl (auth + health + KPI + leads + courses + students + receipts + automation)
6. Stop dev server on exit if it started one

If a route file is missing in `src/app/api`, verification prints `SKIP (route missing)` and continues.

## Production-Ready Local Checklist

- [ ] `.env` uses strong `JWT_SECRET`
- [ ] `.env` sets `N8N_CALLBACK_SECRET` and (optional) `N8N_WEBHOOK_URL`
- [ ] `.env` sets `CRON_SECRET` for internal cron endpoint
- [ ] `DATABASE_URL` and `REDIS_URL` point to intended environment
- [ ] `npm run prisma:validate` passes
- [ ] `npm run prisma:generate` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run verify` passes

## Quản trị người dùng & phân lead

- API quản trị người dùng (chỉ `admin`):
  - `GET/POST /api/users`
  - `GET/PATCH /api/users/[id]`
- Gán telesale cho lead qua `PATCH /api/leads/[id] { ownerId }`
- Khi đổi owner, hệ thống tự ghi `LeadEvent` loại `OWNER_CHANGED` với payload `fromOwnerId/toOwnerId`
- Phân lead vận hành:
  - `POST /api/leads/assign` (gán hàng loạt)
  - `POST /api/leads/auto-assign` (round robin)
- RBAC lead:
  - `admin`: xem/sửa toàn bộ lead
  - `telesales`: chỉ xem lead có `ownerId = user.id`
  - role khác: không truy cập API leads
- UI:
  - Trang quản trị người dùng: `/admin/users`
  - Trang phân lead: `/admin/assign-leads`
  - Filter/gán owner trên `/leads`, `/leads/board`, `/leads/[id]` (hiển thị theo quyền)

## Outbound n8n callback

- Biến môi trường:
  - `N8N_WEBHOOK_URL`: webhook nhận outbound payload.
  - `N8N_CALLBACK_SECRET`: secret xác thực callback `POST /api/outbound/callback`.
- Dispatch outbound (`POST /api/outbound/dispatch`) gửi payload:
  - `messageId`, `channel`, `to`, `text`, `leadId`, `studentId`, `notificationId`, `templateKey`, `createdAt`.
- Callback từ n8n:
  - Header: `x-callback-secret: <N8N_CALLBACK_SECRET>`
  - Body mẫu:
```json
{
  "messageId": "msg_xxx",
  "status": "SENT",
  "providerMessageId": "provider_123",
  "sentAt": "2026-02-14T10:15:00.000Z"
}
```
- Retry/backoff:
  - Khi gửi lỗi hoặc callback `FAILED`, hệ thống tăng `retryCount` và hẹn `nextAttemptAt` theo 2 phút, 10 phút, 60 phút (tối đa 3 lần).

## Cron hằng ngày

- Endpoint nội bộ: `POST /api/cron/daily`
- Bảo vệ bằng header: `x-cron-secret: <CRON_SECRET>` (không dùng session người dùng)
- Body:
```json
{ "dryRun": true, "force": false }
```
- Tác vụ:
  - Sinh thông báo tài chính theo rule hiện có.
  - Khi chạy thật, tự xếp hàng outbound từ thông báo `NEW/DOING` (có dedupe theo ngày).
  - Ghi `AutomationLog` scope `daily` với thống kê đầu ra.
- Trang admin chạy tay: `/admin/cron`.
- Cấu hình vận hành:
  - `OPS_TZ=Asia/Ho_Chi_Minh`
  - `OPS_QUIET_HOURS=21:00-08:00`
  - `OPS_MAX_PER_RUN=200`
  - `OPS_MAX_PER_OWNER=50`
  - `OPS_DEDUPE_WINDOW_DAYS=1`
- Gợi ý schedule n8n local:
  - Trigger theo cron mỗi 30 phút.
  - Gọi `POST /api/cron/daily` với header `x-cron-secret`.
  - Ban ngày gọi bình thường, cần chạy ngoài giờ yên tĩnh thì gửi `force=true`.

## Worker dispatch outbound

- Endpoint secret (không cần session): `POST /api/worker/outbound`
  - Header: `x-worker-secret: <WORKER_SECRET>`
  - Body hỗ trợ: `dryRun`, `batchSize`, `retryFailedOnly`, `force`, `concurrency`
- Endpoint admin UI proxy: `POST /api/admin/worker/outbound` (cookie session + admin role)
- Cấu hình worker:
  - `WORKER_CONCURRENCY=5`
  - `WORKER_RATE_LIMIT_PER_MIN=120`
  - `WORKER_RATE_LIMIT_PER_OWNER_PER_MIN=30`
  - `WORKER_LEASE_SECONDS=60`
  - `WORKER_BATCH_SIZE=50`
  - `WORKER_TZ=Asia/Ho_Chi_Minh`
- Scripts local:
  - `npm run worker:outbound:dry`
  - `npm run worker:outbound`

## Scheduler n8n (Outbound Worker)

1. Tạo workflow n8n với node `Cron` chạy mỗi 1 phút hoặc 2 phút.
2. Thêm node `HTTP Request`:
   - Method: `POST`
   - URL: `https://<host>/api/worker/outbound`
   - Headers:
     - `x-worker-secret: <WORKER_SECRET>`
     - `Content-Type: application/json`
   - Body JSON:
```json
{
  "dryRun": false,
  "batchSize": 50,
  "force": false
}
```
3. Gợi ý cảnh báo:
   - Nếu `failed > 0` thì gửi cảnh báo.
   - Nếu `queued` tăng cao liên tục thì tăng tần suất hoặc tăng `WORKER_CONCURRENCY`.
4. Test local bằng curl:
```bash
curl -sS -X POST http://localhost:3000/api/worker/outbound \
  -H "x-worker-secret: $WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true,"batchSize":20}'
```
5. Khuyến nghị biến môi trường:
   - `WORKER_SECRET`: bắt buộc, secret đủ mạnh.
   - `WORKER_BATCH_SIZE=50`
   - `WORKER_CONCURRENCY=5`
   - `WORKER_RATE_LIMIT_PER_MIN=120`
   - `WORKER_RATE_LIMIT_PER_OWNER_PER_MIN=30`

## Troubleshooting

- Prisma client mismatch:
```bash
npm run prisma:generate
```

- Database connection errors:
```bash
npm run db:up
npm run db:migrate
```

- `next build` fails in restricted sandbox environments:
  run build outside sandbox/CI-restricted process isolation (Turbopack worker spawn requirement).
