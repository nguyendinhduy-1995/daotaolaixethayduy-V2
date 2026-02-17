# RUNBOOK_LOCAL

## 1) Chuẩn bị
- Copy env:
```bash
cp .env.example .env
```
- Mặc định local:
  - Postgres: `localhost:5433`
  - Redis: `localhost:6380`

## 2) Khởi động database
```bash
docker compose up -d
```

## 3) Prisma migrate trên DB local
- Reset DB dev sạch:
```bash
npx prisma migrate reset --force
```
- Seed dữ liệu local (admin mặc định):
```bash
npx prisma db seed
```
- Deploy migration (khi không muốn reset):
```bash
npx prisma migrate deploy
```
- Generate Prisma client:
```bash
npx prisma generate
```

## 4) Chạy ứng dụng
```bash
npm run dev
```
- Truy cập: `http://127.0.0.1:3000` (hoặc port fallback tự chọn bởi `scripts/dev.mjs`).
- Nếu môi trường bị kẹt Turbopack/dev cache, chạy chế độ ổn định:
```bash
npm run dev:stable
```

## 5) Smoke check
```bash
curl -i http://127.0.0.1:3000/api/health/db
```
- Kỳ vọng: HTTP 200 + JSON `{ "ok": true, "db": "connected" }`.

## 6) Lệnh chuẩn scripts
```bash
npm run lint
npm run build
npm run db:up
npm run db:down
npm run db:reset
npm run db:migrate
npm run check:schema
npm run verify
```

## 7) Debug nhanh
- Kiểm tra cổng đang dùng:
```bash
lsof -iTCP -sTCP:LISTEN -n -P | rg '3000|3005|5433|6380'
```
- Kiểm tra container:
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```
- Nếu lỗi lock Next dev:
```bash
pkill -f "next dev" || true
rm -f .next/dev/lock
```

## 8) Production deploy steps
1. Cập nhật env production (`DATABASE_URL`, secrets).
2. Deploy artifacts ứng dụng.
3. Chạy migration:
```bash
npx prisma migrate deploy
```
4. Chạy schema gate (bắt buộc):
```bash
npm run check:schema
```
5. Start app production:
```bash
PORT=3000 HOSTNAME=127.0.0.1 npm run start
```

## 9) Schema gate
- `npm run check:schema` sẽ:
1. Chạy `npx prisma migrate deploy`.
2. Chạy `prisma migrate diff` giữa DB hiện tại và `prisma/schema.prisma`.
3. Fail nếu phát hiện drift schema.

## 10) Playwright/CI
- Playwright yêu cầu `BASE_URL` và không tự spin webServer trong config.
- Local e2e chuẩn (build + start + test):
```bash
npm run test:e2e
```
- Local e2e hardening v2 (bộ test tối thiểu):
```bash
npm run test:e2e:local
```
- CI với URL có sẵn:
```bash
BASE_URL=https://your-env.example.com npx playwright test
```
