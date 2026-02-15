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
- [ ] `.env` sets `OPS_SECRET` for ingest snapshot vận hành từ n8n
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

## AI hỗ trợ nhân sự (Ops Pulse từ n8n)

- Mục tiêu: nhận snapshot vận hành mỗi 10 phút để CRM tự tính gap KPI và gợi ý việc cần làm ngay.
- Biến môi trường:
  - `OPS_SECRET` (bắt buộc cho webhook ingest)
- Endpoint ingest (không cần session):
  - `POST /api/ops/pulse`
  - Header: `x-ops-secret: <OPS_SECRET>`
- Payload mẫu cho Trực Page:
```json
{
  "role": "PAGE",
  "dateKey": "2026-02-15",
  "windowMinutes": 10,
  "metrics": {
    "openMessages": 18,
    "newData": 2
  },
  "targets": {
    "newData": 4,
    "openMessagesMax": 12
  }
}
```
- Payload mẫu cho Telesales:
```json
{
  "role": "TELESALES",
  "ownerId": "user_cuid",
  "dateKey": "2026-02-15",
  "windowMinutes": 10,
  "metrics": {
    "data": 4,
    "called": 3,
    "appointed": 1,
    "arrived": 0,
    "signed": 0
  },
  "targets": {
    "appointed": 4
  }
}
```
- API xem realtime (admin-only):
  - `GET /api/admin/ops/pulse?dateKey=YYYY-MM-DD&role=PAGE|TELESALES&ownerId=&limit=50`
- UI admin:
  - `/admin/ops`
  - Hiển thị trạng thái `OK/WARNING/CRITICAL`, gap KPI và checklist gợi ý ưu tiên.

## KPI nhân sự (theo từng user)

- Mục tiêu: admin thiết lập KPI riêng theo nhân viên và thời gian hiệu lực.
- API admin:
  - `GET /api/admin/employee-kpi?page=&pageSize=&role=&userId=&active=`
  - `POST /api/admin/employee-kpi`
  - `PATCH /api/admin/employee-kpi/[id]`
- UI:
  - `/hr/kpi`
- Thứ tự ưu tiên target khi Ops Pulse tính KPI:
  1. `EmployeeKpiSetting` theo user + role + ngày hiệu lực
  2. `payload.targets` từ n8n
  3. target mặc định hệ thống
- `computedJson` của Ops Pulse lưu thêm:
  - `resolvedTargets`
  - `targetSource` (`user_setting` | `payload` | `default`)
  - `period` (MTD), `mtd`, `ratesGlobalActual`, `ratesGlobalTarget` cho KPI % theo tháng
- KPI % telesales (GLOBAL_DATA_MTD):
  - `calledPctGlobal`, `appointedPctGlobal`, `arrivedPctGlobal`, `signedPctGlobal`
  - Tính theo `Data MTD` từ ngày 01 đến hiện tại, reset đầu tháng.

## Marketing Meta Ads via n8n

- Mục tiêu: nhận báo cáo chi phí Meta Ads theo ngày và số lượng học viên liên hệ để theo dõi CPL.
- Biến môi trường bắt buộc:
  - `MARKETING_SECRET`
- Endpoint ingest (không dùng session, idempotent theo `date+branch+source`):
  - `POST /api/marketing/report`
  - Header: `x-marketing-secret: <MARKETING_SECRET>`
- Payload mẫu theo ngày:
```json
{
  "date": "2026-02-15",
  "source": "meta",
  "branchCode": "HCM",
  "spendVnd": 2500000,
  "messages": 42,
  "meta": { "campaign": "Lead Form" }
}
```
- UI báo cáo:
  - Route: `/marketing` (admin-only)
  - API đọc dữ liệu: `GET /api/admin/marketing/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=&source=meta`
- API admin nhập tay:
  - `POST /api/admin/marketing/report` (cookie session + admin role)

## Vận hành lịch & điểm danh

- API:
  - `GET /api/schedule`: danh sách buổi học + số liệu điểm danh.
  - `GET /api/schedule/[id]`: chi tiết buổi học, học viên, điểm danh, nhật ký.
  - `PATCH /api/schedule/[id]`: cập nhật thông tin buổi.
  - `POST /api/schedule/[id]/attendance`: lưu điểm danh (upsert idempotent) + ghi audit.
- UI:
  - `/schedule`: lọc theo ngày/khóa học/trạng thái/địa điểm/tìm tên-SĐT.
  - `/schedule/[id]`: tab Học viên, Điểm danh, Nhật ký.
- RBAC:
  - `admin`: xem toàn bộ.
  - `telesales`: chỉ xem buổi có học viên thuộc lead owner của mình.

## Student Portal (Cổng học viên)

- Routes:
  - `GET /student/login`, `GET /student/register`
  - `GET /student`, `GET /student/schedule`, `GET /student/content`, `GET /student/finance`
- API học viên:
  - `POST /api/student/auth/register`
  - `POST /api/student/auth/login`
  - `POST /api/student/auth/logout`
  - `GET /api/student/me`
  - `GET /api/student/content`

## Nhân sự: lương tự động + chấm công

- Menu UI:
  - Admin: `/hr/salary-profiles`, `/hr/attendance`, `/hr/payroll`
  - Người dùng: `/me/payroll`
- API admin:
  - Hồ sơ lương: `GET/POST /api/admin/salary-profiles`, `GET/PATCH /api/admin/salary-profiles/[id]`
  - Chấm công: `GET/POST /api/admin/attendance`, `PATCH /api/admin/attendance/[id]`
  - Sổ cái hoa hồng: `GET/POST /api/admin/commissions`
  - Rebuild hoa hồng PAID50 theo tháng: `POST /api/admin/commissions/paid50/rebuild`
  - Rebuild hoa hồng từ receipt: `POST /api/admin/commissions/rebuild`
  - Chạy lương: `POST /api/admin/payroll/generate`, `POST /api/admin/payroll/finalize`, `GET /api/admin/payroll`
- API nhân sự tự xem:
  - `GET /api/me/payroll?month=YYYY-MM`
- Verify:
  - `npm run verify` đã bao gồm flow tạo hồ sơ lương, chấm công, commission manual, chạy/chốt lương.

### Quy tắc hoa hồng PAID50

- Mỗi học viên chỉ được tính **1 lần duy nhất** khi lần đầu chạm mốc 50% học phí.
- Cách xác định mốc:
  - Lấy receipt theo `createdAt` tăng dần.
  - Cộng dồn `amount` đến khi `>= paid50Amount` (mặc định `50%` học phí snapshot/tuition plan).
  - `periodMonth` là tháng `YYYY-MM` của timestamp chạm mốc.
- Rebuild tháng X:
  - Chỉ tạo ledger `sourceType=PAID50` cho học viên có `periodMonth=X`.
  - Idempotent qua unique key `(sourceType, studentId)`, rebuild lại không tạo trùng.
- Mức hoa hồng:
  - `hoa hồng = số học viên first-reached50 trong tháng * branch.commissionPerPaid50`.
  - Cấu hình tại `PATCH /api/admin/branches/[id]` với field `commissionPerPaid50`.
- Auth:
  - Cookie riêng `student_access_token` (httpOnly), không dùng localStorage.
  - Middleware bảo vệ `/student/*` (trừ login/register).
- Admin quản trị nội dung học viên:
  - UI: `/admin/student-content`
  - API: `GET/POST /api/admin/student-content`, `PATCH /api/admin/student-content/[id]`

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
