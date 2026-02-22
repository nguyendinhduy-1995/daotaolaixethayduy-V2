# Users & Admin Management

## Mục đích / Giá trị
Quản lý tài khoản nhân sự hệ thống, phân quyền RBAC theo nhóm và cá nhân.

## User story / Ai dùng
- **Admin**: tạo/sửa/khoá tài khoản, gán nhóm quyền, set override

## Luồng sử dụng
```mermaid
flowchart TD
    A[Admin vào /admin/users] --> B[Xem danh sách users]
    B --> C[Tạo user mới / Sửa user]
    C --> D[Gán role + branch + permission group]

    A --> E[/admin/phan-quyen]
    E --> F[Tạo nhóm quyền]
    F --> G[Set rules: module × action = allowed/denied]
    G --> H[Gán users vào nhóm]
```

## UI/UX
- **URL**: `/admin/users` – quản lý users
- **URL**: `/admin/phan-quyen` – quản lý nhóm quyền
- Bảng: user list + filter (role, branch, active), form tạo/sửa
- Permission matrix UI: checkbox grid module × action

## API liên quan
| Endpoint | Mô tả |
|----------|-------|
| `GET/POST /api/admin/users` | List/create users |
| `GET/PATCH /api/admin/users/{id}` | Detail/update |
| `POST /api/admin/users/bulk-toggle` | Toggle active hàng loạt |
| `GET/PUT /api/admin/users/{id}/permission-overrides` | Override cá nhân |
| `GET/POST /api/admin/permission-groups` | Nhóm quyền |
| `GET/PATCH/DELETE /api/admin/permission-groups/{id}` | CRUD nhóm |
| `GET/PUT /api/admin/permission-groups/{id}/rules` | Rules nhóm |

## Business rules
- Password tạo mới → bcrypt hash
- Email và username @unique
- Toggle isActive → user không login được nữa (nhưng không xoá data)
- System groups (isSystem=true) không xoá được

## Data / DB
- **User**, **PermissionGroup**, **PermissionRule**, **UserPermissionOverride**

## RBAC / Security
- `admin_users:VIEW/CREATE/UPDATE/DELETE`
- Chỉ admin access `/admin/*`

## Todo / Tech debt
- Chưa có audit log cho thay đổi permission
