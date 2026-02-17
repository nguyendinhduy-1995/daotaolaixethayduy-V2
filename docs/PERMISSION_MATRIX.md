# PERMISSION_MATRIX

## 1) Quy ước role và map enum hiện tại
- Enum role trong hệ thống: `admin`, `manager`, `telesales`, `direct_page`, `viewer` (xem `prisma/schema.prisma`).
- Map role nghiệp vụ tối thiểu để tích hợp ngoài:
- `ADMIN` -> `admin`.
- `TELESALES` -> `telesales`, `direct_page`.
- `FINANCE` -> tương đương `manager` (hoặc `admin` nếu chưa tách role tài chính riêng).
- `OPS` -> tương đương `admin` (một phần `manager` có thể xem/điều phối tùy module).

## 2) Scope dữ liệu
- `Toàn hệ thống`: xem/sửa toàn bộ dữ liệu.
- `Theo owner`: chỉ dữ liệu lead/student/receipt có `ownerId` thuộc user hiện tại.
- `Theo chi nhánh`: chỉ dữ liệu thuộc `branchId` được phân quyền.

## 3) Ma trận quyền (Xem/Tạo/Sửa/Xóa/Export/Assign/Run automation)

| Module | ADMIN | TELESALES | FINANCE | OPS | Scope mặc định |
|---|---|---|---|---|---|
| Tổng quan | Xem, Export | Xem | Xem, Export | Xem | ADMIN/OPS: toàn hệ thống; TELESALES: theo owner |
| Khách hàng | Xem, Tạo, Sửa, Assign, Export | Xem, Tạo, Sửa | Xem | Xem, Assign | TELESALES theo owner |
| Bảng trạng thái | Xem, Sửa, Assign | Xem, Sửa | Xem | Xem, Sửa | theo owner hoặc toàn hệ thống theo role |
| KPI ngày | Xem, Export | Xem | Xem, Export | Xem, Export | theo owner hoặc toàn hệ thống |
| Mục tiêu KPI | Xem, Sửa | Xem | Xem | Xem, Sửa | manager/admin theo chi nhánh; admin có thể đa chi nhánh |
| Mục tiêu ngày/tháng | Xem, Sửa | Xem | Xem | Xem, Sửa | manager/admin theo chi nhánh; admin có thể toàn hệ thống |
| Trợ lý công việc | Xem, Tạo, Sửa | Xem | Xem | Xem, Tạo | theo owner+branch cho telesales/direct_page; manager theo branch |
| Học viên | Xem, Tạo, Sửa, Export | Xem, Tạo, Sửa | Xem | Xem, Sửa | TELESALES theo owner |
| Khóa học | Xem, Tạo, Sửa, Export | Xem | Xem | Xem, Tạo, Sửa | toàn hệ thống |
| Lịch học | Xem, Tạo, Sửa, Export | Xem, Tạo, Sửa | Xem | Xem, Tạo, Sửa | TELESALES theo owner; ADMIN toàn hệ thống |
| Thu tiền | Xem, Tạo, Sửa, Export | Xem, Tạo, Sửa | Xem, Tạo, Sửa, Export | Xem | TELESALES theo owner; FINANCE toàn hệ thống/chi nhánh |
| Thông báo | Xem, Tạo, Sửa, Export | Xem, Sửa | Xem | Xem, Tạo, Sửa | theo scope module |
| Gửi tin | Xem, Tạo, Sửa, Export, Run automation | Xem, Tạo | Xem | Xem, Run automation | theo queue/scope owner |
| Lương tôi | Xem | Xem | Xem | Xem | chỉ bản thân |
| AI hỗ trợ nhân sự | Xem, Export | - | Xem | Xem, Run automation | ADMIN/OPS toàn hệ thống |
| Luồng n8n | Xem, Export | - | Xem | Xem, Run automation | ADMIN/OPS toàn hệ thống |
| Tự động hóa - Nhật ký | Xem, Export | Xem (scope hạn chế) | Xem | Xem, Export | theo quyền route |
| Tự động hóa - Chạy tay | Run automation, Xem | - | - | Run automation, Xem | ADMIN/OPS |
| Báo cáo Meta Ads | Xem, Tạo, Sửa, Export | - | Xem, Export | Xem, Export | theo chi nhánh/toàn hệ thống |
| Chi nhánh | Xem, Tạo, Sửa, Xóa* | - | Xem | Xem | toàn hệ thống |
| Người dùng | Xem, Tạo, Sửa, Xóa* | - | Xem (hạn chế) | Xem | toàn hệ thống |
| Phân khách hàng | Xem, Assign | - | - | Assign | toàn hệ thống hoặc theo nhóm được giao |
| Bảng học phí | Xem, Tạo, Sửa, Xóa* | - | Xem, Sửa | Xem | toàn hệ thống |
| Quản trị thông báo | Xem, Tạo, Sửa, Export | - | Xem | Xem, Sửa | toàn hệ thống |
| Vận hành tự động | Xem, Run automation | - | - | Run automation | toàn hệ thống |
| Tiến trình gửi tin | Xem, Run automation | - | - | Run automation | toàn hệ thống |
| Lập lịch | Xem, Run automation | - | - | Run automation | toàn hệ thống |
| Nội dung học viên | Xem, Tạo, Sửa, Xóa* | - | Xem | Xem, Sửa | toàn hệ thống |
| KPI nhân sự | Xem, Tạo, Sửa, Export | - | Xem, Export | Xem, Sửa | toàn hệ thống/chi nhánh |
| Hồ sơ lương | Xem, Tạo, Sửa, Export | - | Xem, Tạo, Sửa, Export | Xem | theo chi nhánh/toàn hệ thống |
| Chấm công | Xem, Tạo, Sửa, Export | - | Xem, Tạo, Sửa, Export | Xem | theo chi nhánh/toàn hệ thống |
| Tổng lương | Xem, Tạo, Sửa, Export, Run automation | - | Xem, Export | Xem, Run automation | theo chi nhánh/toàn hệ thống |
| API Hub | Xem | Xem | Xem | Xem | authenticated + permission `api_hub:VIEW` |
| Hướng dẫn vận hành | Xem | Xem | Xem | Xem | authenticated; nội dung nhạy cảm ẩn theo quyền module |
| Chi phí ngày | Xem, Sửa | Xem | Xem, Sửa | Xem, Sửa | ADMIN: toàn hệ thống; manager/finance: theo chi nhánh |
| Lương cơ bản | Xem, Sửa | Xem | Xem, Sửa | Xem, Sửa | ADMIN: toàn hệ thống; manager/finance: theo chi nhánh |
| Insight chi phí | Xem, Ingest | Xem | Xem | Xem, Ingest | Ingest dùng service token route riêng |

## 4) Ghi chú triển khai
- `Xóa*`: hiện nhiều module chưa có API xóa cứng; hệ thống ưu tiên `isActive`/trạng thái.
- `FINANCE` và `OPS` hiện là role nghiệp vụ để tích hợp; trong code cần map sang role enum tương ứng ở tầng auth gateway.
- Khi tích hợp ngoài, bắt buộc enforce scope ở backend API thay vì chỉ ẩn UI.

## 5) Nhóm quyền (Role Group) và Override theo User
- Bảng dữ liệu RBAC:
- `PermissionGroup`: nhóm quyền.
- `PermissionRule`: quyền theo `module + action + allowed` cho từng nhóm.
- `UserPermissionOverride`: override trực tiếp theo `userId + module + action + allowed`.
- `User.groupId`: user gán vào 1 nhóm quyền (nullable).
- Quy tắc merge hiệu lực:
- Bước 1: lấy quyền mặc định theo role (`DEFAULT_ROLE_PERMISSIONS`).
- Bước 2: áp `PermissionRule` của nhóm (`groupId`) để ghi đè.
- Bước 3: áp `UserPermissionOverride` để ghi đè cuối cùng.
- Ưu tiên cao nhất: `override theo user` > `nhóm quyền` > `mặc định theo role`.
- Hệ quả triển khai:
- API route luôn check quyền ở backend bằng module/action.
- UI chỉ hiển thị menu/nút khi có quyền tương ứng, nhưng không thay thế kiểm tra API.
