# Goals Management

## Mục đích / Giá trị
Đặt mục tiêu doanh thu, hồ sơ, chi phí theo ngày hoặc tháng, so sánh thực tế.

## User story / Ai dùng
- **Admin/Manager**: đặt và theo dõi mục tiêu
- **Tất cả**: xem mục tiêu

## Luồng sử dụng
```mermaid
flowchart LR
    A[Vào /goals] --> B[Chọn kỳ DAILY/MONTHLY]
    B --> C[Nhập revenueTarget / dossierTarget / costTarget]
    C --> D[POST /api/goals upsert]
    D --> E[So sánh với dữ liệu thực]
```

## UI/UX
- **URL**: `/goals`
- Bảng hiển thị: ngày/tháng, mục tiêu doanh thu, hồ sơ, chi phí, thực tế, % đạt

## API liên quan
| Endpoint | Mô tả |
|----------|-------|
| `GET /api/goals` | Lấy mục tiêu |
| `POST /api/goals` | Upsert mục tiêu |

## Business rules
- **periodType**: DAILY hoặc MONTHLY
- **branchScopeKey**: "" = toàn hệ thống, khác = theo chi nhánh
- **Unique**: `[branchScopeKey, periodType, dateKey, monthKey]` – chỉ 1 goal per scope/period
- Mục tiêu tính bằng VND hoặc số lượng

## Data / DB
- **GoalSetting**: periodType, dateKey, monthKey, revenueTarget, dossierTarget, costTarget, note

## RBAC / Security
- `goals:VIEW` – xem, `goals:EDIT` – tạo/cập nhật

## Todo / Tech debt
- Chưa có biểu đồ trend theo tuần/tháng
