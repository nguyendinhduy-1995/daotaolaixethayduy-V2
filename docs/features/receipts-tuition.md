# Receipts & Tuition

## Mục đích / Giá trị
Ghi nhận thu tiền học phí, quản lý bảng giá học phí theo tỉnh/hạng bằng.

## User story / Ai dùng
- **Telesales/Manager**: tạo phiếu thu cho học viên
- **Admin**: quản lý bảng giá, xem tổng hợp doanh thu

## Luồng sử dụng
```mermaid
flowchart LR
    A[Chọn học viên] --> B[Nhập số tiền + phương thức]
    B --> C[POST /api/receipts<br/>+ Idempotency-Key]
    C --> D[Insert Receipt]
    D --> E[Trigger commission check]
```

## UI/UX
- **`/receipts`**: Bảng phiếu thu + filter
- **`/admin/tuition-plans`**: Bảng giá học phí

## API liên quan
| Endpoint | Mô tả |
|----------|-------|
| `GET/POST /api/receipts` | Danh sách / tạo phiếu thu |
| `GET /api/receipts/summary` | Tổng hợp doanh thu |
| `GET/PATCH /api/receipts/{id}` | Chi tiết / sửa |
| `GET/POST /api/tuition-plans` | Bảng giá |
| `GET/PATCH /api/tuition-plans/{id}` | Chi tiết / sửa |
| `GET /api/public/tuition-plans` | Bảng giá công khai |

## Business rules
- Phiếu thu bắt buộc `Idempotency-Key` (chống tạo trùng)
- TuitionPlan: @@unique([province, licenseType])
- Receipt amount = VND integer
- Method: cash / bank_transfer / card / other
- Tạo receipt có thể trigger commission calculation

## Data / DB
- **Receipt**: studentId, branchId, amount, method, receivedAt, createdById
- **TuitionPlan**: province, licenseType, tuition, isActive

## RBAC / Security
- `receipts:VIEW/CREATE/UPDATE`
- `admin_tuition:VIEW/CREATE/UPDATE`

## Todo / Tech debt
- Chưa có invoice generation / PDF export
