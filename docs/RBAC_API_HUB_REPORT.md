# RBAC_API_HUB_REPORT

## Mục tiêu harden
- Đồng bộ quyền API Hub giữa Menu UI và Page guard theo một nguồn truth.
- Giữ API Hub là private (authenticated + permission), không mở public allowlist.

## Permission key chuẩn
- Module key: `api_hub`
- Action: `VIEW`
- Permission string: `api_hub:VIEW`
- Nguồn truth:
  - `src/lib/permission-keys.ts` (định nghĩa `api_hub`)
  - `src/lib/permissions.ts` (default permissions theo role)
  - `src/lib/ui-permissions.ts` (`/api-hub` -> `api_hub`)

## Mapping quyền hiện tại
- `src/lib/permission-keys.ts`
  - Có `api_hub` trong `MODULE_KEYS`.
- `src/lib/permissions.ts`
  - ADMIN: full permissions (bao gồm `api_hub:VIEW`).
  - Manager/Telesales/Direct page/Viewer: đều có `api_hub:VIEW` theo default hiện tại.
- `src/lib/ui-permissions.ts`
  - `moduleKeyFromHref("/api-hub") => "api_hub"`.

## Route/UI flow quyền
1. Menu render
- `src/lib/admin-menu.ts` chứa item `/api-hub`.
- `src/components/mobile/MobileAdminMenu.tsx` và `src/app/(app)/layout.tsx` lọc theo `hasUiPermission(..., "api_hub", "VIEW")`.

2. Route protect
- `middleware.ts` coi `/api-hub` là protected path (cần session hợp lệ).

3. Page guard
- `src/app/(app)/api-hub/page.tsx` gọi `/api/auth/me` và check `api_hub:VIEW`.
- Không có quyền -> hiển thị `Bạn không có quyền truy cập`.

## API mapping liên quan
- API Hub page hiện dùng catalog tĩnh từ `src/lib/api-catalog.ts` và chỉ gọi `/api/auth/me` để check quyền.
- Không mở public allowlist riêng cho API Hub.
- Route `/api/auth/*` vẫn thuộc public allowlist để xử lý auth flow đúng tầng route.

## Quyết định
- Giữ `api_hub:VIEW` làm key duy nhất cho API Hub UI.
- Menu check và page guard check dùng cùng source truth (`permission-keys` + `ui-permissions`).
- Không tạo public access cho `/api-hub`.

## Cập nhật docs
- `PERMISSION_MATRIX.md` đã bổ sung dòng `API Hub` trong ma trận module/quyền.
