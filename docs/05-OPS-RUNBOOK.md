# 05 – Ops Runbook

> **Mục đích**: Hướng dẫn chạy local, deploy, cron/worker, backup/migration, troubleshooting.

---

## 1. Chạy local (Development)

### Yêu cầu

- Node.js ≥ 20
- Docker + Docker Compose (cho PostgreSQL + Redis)

### Các bước

```bash
# 1. Clone repo
git clone https://github.com/nguyendinhduy-1995/daotaolaixethayduy-V2.git
cd thayduy-crm

# 2. Cài dependencies
npm install

# 3. Copy env
cp .env.example .env
# Edit .env theo nhu cầu (đặc biệt JWT_SECRET, DATABASE_URL)

# 4. Khởi động PostgreSQL + Redis
npm run db:up
# → docker compose up -d postgres redis
# PostgreSQL: localhost:5433
# Redis: localhost:6380

# 5. Chạy migration
npx prisma migrate deploy

# 6. Generate Prisma client
npx prisma generate

# 7. Seed data (tuỳ chọn)
npm run seed:admin       # Tạo admin user
npm run seed:templates   # Seed message templates
npm run seed:tuition     # Seed bảng học phí
npm run seed:demo        # Seed dữ liệu demo đầy đủ

# 8. Khởi động dev server
npm run dev              # Next.js dev (auto port select)
npm run dev:stable       # Dev + ổn định hơn
```

### ENV Variables (Quan trọng)

| Biến | Mô tả | Mặc định (dev) |
|------|--------|----------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://thayduy:thayduy123@localhost:5433/thayduy_crm?schema=public` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6380` |
| `JWT_SECRET` | Secret cho JWT signing | `change-this-to-a-long-random-secret` |
| `N8N_WEBHOOK_URL` | URL webhook N8N | (trống = mock local) |
| `N8N_CALLBACK_SECRET` | Secret cho N8N callback | `change-this-callback-secret` |
| `CRON_SECRET` | Secret cho cron endpoint | `change-this-cron-secret` |
| `WORKER_SECRET` | Secret cho worker endpoint | `change-this-worker-secret` |
| `MARKETING_SECRET` | Secret cho marketing ingest | `change-this-marketing-secret` |
| `OPS_SECRET` | Secret cho ops pulse | `change-this-ops-secret` |
| `SERVICE_TOKEN` | Service token cho ingest endpoints | `change-this-service-token` |
| `CRM_HMAC_SECRET` | HMAC secret cho PWA link | `change-this-hmac-secret` |
| `OPS_TZ` | Timezone operations | `Asia/Ho_Chi_Minh` |
| `OPS_QUIET_HOURS` | Giờ yên tĩnh (không gửi tin) | `21:00-08:00` |
| `OPS_MAX_PER_RUN` | Max messages per cron run | `200` |
| `OPS_MAX_PER_OWNER` | Max messages per owner | `50` |
| `OPS_DEDUPE_WINDOW_DAYS` | Cửa sổ chống trùng (ngày) | `1` |
| `WORKER_CONCURRENCY` | Số worker song song | `5` |
| `WORKER_RATE_LIMIT_PER_MIN` | Rate limit/phút | `120` |
| `WORKER_BATCH_SIZE` | Batch size dispatch | `50` |
| `WORKER_LEASE_SECONDS` | Lease timeout | `60` |

---

## 2. Docker Compose (Development)

**File**: `docker-compose.yml`

```yaml
# Khởi động đầy đủ
docker compose up -d

# Chỉ database
docker compose up -d postgres redis

# Dừng
docker compose down

# Reset database
npm run db:reset
```

---

## 3. Deploy Production

### Kiến trúc Production

```
Server (Ubuntu) ─ Docker Compose
├── thayduy-app    (Next.js container, port 3000)
├── postgres       (PostgreSQL, port 5432 internal)
├── redis          (Redis, port 6379 internal)
├── nginx          (Reverse proxy, port 80/443)
└── certbot        (SSL cert renewal)
```

### Domains

| Domain | Target |
|--------|--------|
| `thayduydaotaolaixe.com` | Landing page (`/`) |
| `crm.thayduydaotaolaixe.com` | CRM admin (`/(app)/*`) |
| `taplai.thayduydaotaolaixe.com` | App học lý thuyết (separate container) |

### Deploy Steps

```bash
# 1. SSH vào server
ssh user@76.13.190.139

# 2. Pull code mới
cd /opt/thayduy
git pull origin main

# 3. Build & restart containers
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 4. Run migrations
docker compose -f docker-compose.prod.yml exec thayduy-app npx prisma migrate deploy

# 5. Verify
docker compose -f docker-compose.prod.yml logs -f thayduy-app
curl -s https://crm.thayduydaotaolaixe.com/api/health
```

### SSL (Let's Encrypt)

```bash
# Tạo cert lần đầu
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d thayduydaotaolaixe.com -d crm.thayduydaotaolaixe.com

# Renew (cron hàng tháng)
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 4. Cron / Worker / Queue

### Daily Cron

N8N gọi `POST /api/cron/daily` (hoặc admin chạy tay từ `/admin/cron`):

1. Generate notifications (FINANCE, FOLLOWUP, SCHEDULE)
2. Detect stale leads
3. Compute KPI snapshots
4. Trigger automation workflows

**Secret**: `CRON_SECRET` → header `x-cron-secret`

### Outbound Worker

N8N gọi `POST /api/worker/outbound` (hoặc admin chạy từ `/admin/worker`):

1. Lease batch messages (QUEUED → leased)
2. Forward to N8N webhook
3. N8N processes (Zalo/SMS/Call)
4. Callback `POST /api/outbound/callback` cập nhật status

**Secret**: `WORKER_SECRET` → header `x-worker-secret`

### Ops Pulse (10 phút / lần)

N8N gọi `POST /api/ops/pulse`:
- Collect realtime metrics per role/owner/branch
- Lưu vào `OpsPulse` table
- Admin xem tại `/admin/ops`

---

## 5. Backup / Migration

### Database Backup

**Script**: `scripts/backup-postgres.sh`

```bash
# Manual backup
bash scripts/backup-postgres.sh

# Output: thayduy_crm_backup_YYYYMMDD_HHMMSS.sql.gz
```

### Prisma Migrations

```bash
# Tạo migration mới
npx prisma migrate dev --name <migration_name>

# Apply migration (production)
npx prisma migrate deploy

# Reset toàn bộ (DEV ONLY!)
npx prisma migrate reset --force

# Check schema sync
npm run check:schema
```

---

## 6. Scripts hữu ích

| Script | Mô tả | Câu lệnh |
|--------|--------|---------|
| `scripts/seed-admin.ts` | Tạo admin user | `npm run seed:admin` |
| `scripts/seed-templates.ts` | Seed message templates | `npm run seed:templates` |
| `scripts/seed-tuition-plans.ts` | Seed bảng học phí | `npm run seed:tuition` |
| `scripts/seed-users.ts` | Seed nhiều users | `npx tsx scripts/seed-users.ts` |
| `scripts/upsert-tuition-plans.ts` | Upsert tuition plans | `npx tsx scripts/upsert-tuition-plans.ts` |
| `scripts/simulate-n8n.sh` | Test N8N webhooks locally | `npm run n8n:verify` |
| `scripts/smoke-ai-kpi.sh` | Smoke test AI KPI | `bash scripts/smoke-ai-kpi.sh` |
| `scripts/verify.sh` | Full verification script | `bash scripts/verify.sh` |
| `scripts/verify-full.sh` | Full verify + build | `bash scripts/verify-full.sh` |
| `scripts/demo-reset.sh` | Reset demo environment | `bash scripts/demo-reset.sh` |
| `scripts/audit-route-permissions.ts` | Audit route ↔ RBAC mapping | `npm run audit:permissions` |
| `scripts/backfill-branch-id.mjs` | Backfill branchId cũ | `node scripts/backfill-branch-id.mjs` |

---

## 7. Testing

```bash
# Unit tests (Vitest)
npm run test:unit
npm run test:unit:watch
npm run test:unit:coverage

# E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:ui         # Playwright UI
npm run test:e2e:report     # Xem report

# Hardening tests
npm run test:e2e:hardening
```

---

## 8. Troubleshooting Checklist

| Vấn đề | Kiểm tra |
|--------|---------|
| Không đăng nhập được | Check `JWT_SECRET` env, PostgreSQL connection, kiểm tra user `isActive` |
| API 403 Forbidden | Kiểm tra role + permission, xem `route-permissions-map.ts` |
| Prisma client lỗi | Chạy `npx prisma generate`, kiểm tra `DATABASE_URL` |
| N8N webhook không hoạt động | Check `N8N_WEBHOOK_URL`, `SERVICE_TOKEN`, `CRON_SECRET` |
| Worker không gửi tin | Check `WORKER_SECRET`, Redis connection, OutboundMessage status |
| Build lỗi | Chạy `npm run verify`, check TypeScript errors |
| CORS lỗi | Check `next.config.ts` headers, nginx proxy config |
| Không xem được trang admin | Check middleware guard (role ≠ admin → redirect) |
| Database migration lỗi | `npx prisma migrate status`, fix migration rồi `deploy` lại |
| Docker container crash | `docker logs thayduy-app`, check memory/CPU |
| SSL cert expired | `docker compose run --rm certbot renew` + nginx reload |
| Redis timeout | Check `REDIS_URL`, restart redis container |
| Student portal 403 | Check `student_access_token` cookie, StudentAccount tồn tại |
