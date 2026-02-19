# Runbook — Production Operations

## 1. N8N Workflows

### 1.1 Daily Health Check
```bash
# Check all workflow statuses in N8N
curl -s http://n8n.domain.com/api/v1/workflows -H "X-N8N-API-KEY: $N8N_API_KEY" | python3 -m json.tool

# Check CRM health
curl -s https://crm.thayduydaotaolaixe.com/api/health
```

### 1.2 Common Issues + 3-Minute Fix

| Symptom | Check | Fix |
|---------|-------|-----|
| Workflow not running | N8N UI → check Active toggle | Toggle on, save |
| Auth token expired | N8N execution → "401" error | Verify `CRM_EMAIL`/`CRM_PASSWORD` |
| Facebook webhook 404 | Facebook Dev Console → check webhook URL | Update URL in Facebook App settings |
| Zalo OA rate limit | N8N logs → "429" error | Wait until next day quota reset |
| CRM 500 errors | `docker logs crm --tail 50` | Check DB connection, disk space |
| N8N memory | `docker stats n8n` | Restart: `docker restart n8n` |

### 1.3 Restart Procedures
```bash
# Restart N8N only
docker restart n8n

# Restart CRM + Redis
docker-compose restart crm redis

# Full restart
docker-compose down && docker-compose up -d
```

### 1.4 Backup
```bash
# Database backup
pg_dump -U admin crm_db > backup_$(date +%Y%m%d).sql

# N8N data backup
docker cp n8n:/home/node/.n8n ./n8n-backup-$(date +%Y%m%d)
```

---

## 2. Environment Variables

### 2.1 Required — CRM Server
| Variable | Purpose | Where to set |
|----------|---------|--------------|
| `DATABASE_URL` | PostgreSQL connection | `.env` / Docker |
| `JWT_SECRET` | JWT signing key | `.env` / Docker |
| `REDIS_URL` | Redis connection | `.env` / Docker |
| `NEXT_PUBLIC_BASE_URL` | Public URL | `.env` |
| `WEBHOOK_SECRET` | Lead ingest verification | `.env` / N8N |

### 2.2 Required — N8N
| Variable | Purpose | Where to set |
|----------|---------|--------------|
| `CRM_BASE_URL` | CRM API base | N8N env |
| `CRM_EMAIL` | Admin login email | N8N env |
| `CRM_PASSWORD` | Admin login password | N8N env |
| `FB_PAGE_TOKEN` | Facebook Page token (long-lived) | N8N env |
| `FB_APP_SECRET` | Facebook App secret (webhook verify) | N8N env |
| `OPS_SECRET` | Ops pulse API key | N8N env + CRM .env |
| `TELEGRAM_BOT_TOKEN` | Alert bot token | N8N env |
| `TELEGRAM_CHAT_ID` | Alert chat ID | N8N env |

### 2.3 Optional — Feature Flags
| Variable | Purpose | Default |
|----------|---------|---------|
| `ZALO_OA_ACCESS_TOKEN` | Zalo OA integration | empty (disabled) |
| `ZALO_OA_APP_ID` | Zalo OA App ID | empty |
| `ZALO_OA_DRY_RUN` | Zalo dry run mode | `true` |
| `OPENAI_API_KEY` | AI KPI Coach | empty (disabled) |

---

## 3. E2E Tests

### 3.1 Run Tests
```bash
# Prerequisites
docker-compose up -d  # Start DB + Redis
npm run seed:demo     # Seed test data
npm run dev           # Start dev server

# Run all E2E
npm run test:e2e

# Run specific suite
npx playwright test tests/e2e/crm-critical.spec.ts
npx playwright test tests/e2e/responsive.spec.ts
npx playwright test tests/e2e/landing.spec.ts

# View HTML report
npx playwright show-report
```

### 3.2 CI Pipeline
```yaml
# GitHub Actions example
- name: E2E Tests
  run: |
    npm ci
    npx prisma generate
    npx prisma db push
    npm run seed:demo
    npm run build
    npx playwright install --with-deps
    npx playwright test
```

### 3.3 E2E Report Page
Navigate to `/admin/qa/e2e-report` (admin only) to see:
- Last run timestamp
- Pass/fail summary
- Screenshots from `docs/e2e-snapshots/`

---

## 4. Monitoring Alerts

### 4.1 Health Endpoints
| Endpoint | Expected | Frequency |
|----------|----------|-----------|
| `GET /api/health` | `{"ok": true}` | Every 1 min |
| `GET /api/events` | SSE stream | Persistent |

### 4.2 Alert Channels
| Channel | Used for |
|---------|----------|
| Telegram Bot | N8N workflow failures, stale leads |
| CRM Dashboard | KPI updates, new leads (via SSE) |
| Email (future) | Daily summary report |

---

## 5. Scaling Notes

### 5.1 Current Architecture
- **CRM**: Next.js on Docker (single instance)
- **DB**: PostgreSQL on Docker
- **Cache**: Redis on Docker
- **N8N**: Separate Docker container

### 5.2 When to Scale
| Metric | Threshold | Action |
|--------|-----------|--------|
| Response time > 2s | Consistent | Add Redis caching to hot queries |
| DB connections > 80% | Sustained | Increase `connection_limit` in pool |
| N8N queue > 100 | Sustained | Add N8N worker instance |
| Memory > 2GB | CRM container | Optimize queries, add pagination |
