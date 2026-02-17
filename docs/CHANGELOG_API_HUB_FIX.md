# CHANGELOG_API_HUB_FIX

## Summary
- Sửa lỗi `API Hub (/api-hub)` không hiển thị dù đã có quyền.
- Chuẩn hóa check quyền `api_hub:VIEW` đồng nhất giữa Menu và Page guard.
- Bổ sung test tối thiểu cho case admin có quyền và user bị deny.

## Root cause
1. Menu config thiếu item `/api-hub`
- `src/lib/admin-menu.ts` không có item `API Hub` nên Mobile menu không thể render.
- Desktop nav trong `src/app/(app)/layout.tsx` cũng không có link `/api-hub`.

2. Route `/api-hub` chưa nằm trong protected paths middleware
- `middleware.ts` chưa include `pathname.startsWith("/api-hub")` trong `isProtectedPath`.
- Dễ gây hành vi không đồng nhất giữa middleware và client guard.

3. Page API Hub chưa tự kiểm tra quyền module
- `src/app/(app)/api-hub/page.tsx` chỉ render UI catalog, không guard `api_hub:VIEW`.
- Nếu user vào URL trực tiếp, không có thông báo deny rõ ràng theo module.

## Request path (menu -> route -> api)
- Menu:
  - `ADMIN_MENU` -> `MobileAdminMenu` -> filter bằng `moduleKeyFromHref("/api-hub") => api_hub` + `hasUiPermission(..., "api_hub", "VIEW")`.
- Route page:
  - User click menu -> `/api-hub`.
  - Middleware giờ đã coi `/api-hub` là protected path.
- API phụ trợ page:
  - Page gọi `fetchMe()` -> `/api/auth/me` để lấy permissions.
  - Page tự check `api_hub:VIEW` trước khi render catalog.

## Minimal fix đã áp dụng
- `src/lib/admin-menu.ts`
  - Thêm item menu `API Hub` (`href: /api-hub`).
- `src/app/(app)/layout.tsx`
  - Thêm nav link `API Hub` vào nhóm Quản trị.
- `middleware.ts`
  - Thêm `/api-hub` vào protected path.
- `src/app/(app)/api-hub/page.tsx`
  - Thêm guard quyền `api_hub:VIEW` (loading/timeout/error/forbidden).
  - Với user không quyền: hiển thị `Bạn không có quyền truy cập`.

## Test added
- `tests/rbac-permissions.spec.ts`
  - `API Hub: admin thấy menu và truy cập được`.
  - `API Hub: user không có quyền thì ẩn menu và bị chặn ở page`.

## Verify
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run audit:permissions`: PASS
- Playwright: có test mới, chạy qua pipeline khi set `BASE_URL`.
