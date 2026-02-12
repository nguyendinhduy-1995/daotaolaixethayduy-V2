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
- UI:
  - Trang quản trị người dùng: `/admin/users`
  - Filter/gán owner trên `/leads`, `/leads/board`, `/leads/[id]` (hiển thị theo quyền)

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
