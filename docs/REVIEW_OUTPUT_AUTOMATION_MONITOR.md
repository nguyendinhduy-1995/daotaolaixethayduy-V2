# REVIEW OUTPUT AUTOMATION MONITOR

## 1) What changed
- Tạo module admin read-only mới: `Giám sát luồng tự động` tại route `/admin/automation-monitor`.
- Tạo 4 API admin-only, read-only để phục vụ trang giám sát:
  - `GET /api/admin/automation/overview`
  - `GET /api/admin/automation/jobs`
  - `GET /api/admin/automation/logs`
  - `GET /api/admin/automation/errors`
- Tất cả API mới dùng auth hiện có + guard admin, có mapping RBAC deny-by-default trong `route-permissions-map`.
- Tích hợp menu dưới nhóm `Tự động hoá`: `Giám sát luồng tự động`.
- Cập nhật tiêu đề layout cho route mới.
- Bổ sung index tối thiểu cho truy vấn monitor:
  - `AutomationLog(branchId, milestone, sentAt)`.

## 2) Screens described
### Màn hình `/admin/automation-monitor`
- **Khối Tổng quan**:
  - OutboundJob hôm nay/tháng này theo trạng thái `NEW/DISPATCHED/DONE/FAILED`.
  - AutomationLog theo milestone cho hôm nay/tháng này.
- **Khối Lỗi nổi bật**:
  - Top lỗi `lastError` từ job `FAILED`, gồm số lần và thời điểm gần nhất.
- **Khối Việc gọi nhắc gần đây**:
  - Danh sách tối đa 50 OutboundJob.
  - Filter: ngày, branchId, status, channel, runId.
- **Chi tiết dạng Drawer/Modal** khi click một job:
  - Hiển thị `metaJson`, `taskId`, `suggestionId`, `runId`, timestamps.
  - Hiển thị AutomationLogs liên quan (lọc theo runId/suggestionId/outboundJobId).

## 3) Endpoints + sample curl
### 3.1 Tổng quan
```bash
curl -sS 'http://localhost:3000/api/admin/automation/overview?date=2026-02-16' \
  -H 'Authorization: Bearer REDACTED'
```

### 3.2 Danh sách jobs
```bash
curl -sS 'http://localhost:3000/api/admin/automation/jobs?date=2026-02-16&status=FAILED&channel=CALL_NOTE&limit=50' \
  -H 'Authorization: Bearer REDACTED'
```

### 3.3 Danh sách logs
```bash
curl -sS 'http://localhost:3000/api/admin/automation/logs?date=2026-02-16&runId=run-2026-02-16-01&limit=100' \
  -H 'Authorization: Bearer REDACTED'
```

### 3.4 Top lỗi
```bash
curl -sS 'http://localhost:3000/api/admin/automation/errors?date=2026-02-16&limit=10' \
  -H 'Authorization: Bearer REDACTED'
```

## 4) RBAC requirements
- Các API monitor map vào module `ops_n8n:VIEW` và vẫn yêu cầu admin role tại route.
- Route UI `/admin/automation-monitor` map quyền UI sang `ops_n8n`.
- Menu chỉ hiển thị khi user có quyền `VIEW` module tương ứng.

## 5) Manual test steps
1. Đăng nhập admin.
2. Vào `/admin/automation-monitor`.
3. Kiểm tra khối tổng quan hiển thị số liệu hôm nay/tháng này.
4. Thử đổi filter `status/channel/runId` và bấm `Làm mới`.
5. Click một dòng job, kiểm tra modal chi tiết và log liên quan.
6. Đăng nhập user không phải admin, truy cập API monitor phải bị từ chối.

## 6) DB changes/migrations
- `prisma/migrations/20260217007000_automation_monitor_indexes/migration.sql`
  - thêm index `AutomationLog_branchId_milestone_sentAt_idx`.

## 7) Files changed
- `src/app/(app)/admin/automation-monitor/page.tsx`
- `src/app/api/admin/automation/overview/route.ts`
- `src/app/api/admin/automation/jobs/route.ts`
- `src/app/api/admin/automation/logs/route.ts`
- `src/app/api/admin/automation/errors/route.ts`
- `src/lib/services/automation-monitor.ts`
- `src/lib/admin-menu.ts`
- `src/lib/ui-permissions.ts`
- `src/lib/route-permissions-map.ts`
- `src/app/(app)/layout.tsx`
- `src/lib/api-catalog.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260217007000_automation_monitor_indexes/migration.sql`
- `docs/REVIEW_OUTPUT_AUTOMATION_MONITOR.md`

## 8) Verify results
- `npm run lint`: **PASS**
- `npm run build`: **PASS**
- `npm run verify`: **PASS**
- `npx prisma migrate reset --force`: **PASS**
- `npx prisma db seed`: **PASS**

Ghi chú:
- Có warning `MODULE_TYPELESS_PACKAGE_JSON` khi chạy script ts-node, không ảnh hưởng kết quả.
