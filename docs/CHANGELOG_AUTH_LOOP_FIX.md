# CHANGELOG_AUTH_LOOP_FIX

## Summary
- Sửa lỗi `/login` bị xoay/redirect sai do guard auth dùng sai kết quả trả về.
- Chuẩn hóa phân loại lỗi xác thực:
  - Thiếu token/token sai/token hết hạn => `401`
  - Có token hợp lệ nhưng thiếu quyền => `403`
- Sửa `/api/auth/me` để trả lỗi 401 đúng ngữ nghĩa và message tiếng Việt phù hợp.

## Files changed
- `src/app/api/auth/me/route.ts`
  - Trả `401 AUTH_UNAUTHENTICATED` khi không xác thực được.
  - Trả `401 AUTH_INVALID_TOKEN` khi token hợp lệ cú pháp nhưng user không còn hợp lệ/inactive.
  - Không dùng message forbidden cho lỗi 401.
- `src/lib/api-error-vi.ts`
  - Bổ sung message auth tiếng Việt: `unauthenticated`, `invalidToken`.
- `src/lib/error-messages-vi.ts`
  - Bổ sung map `AUTH_UNAUTHENTICATED` cho client.
- `src/lib/ui-auth-guard.ts`
  - Thêm option `redirectOnUnauthorized` (mặc định `true`) để tránh redirect loop ở trang login.
- `src/app/login/page.tsx`
  - Dùng `guardByAuthMe(router, { redirectOnUnauthorized: false })`.
  - Chỉ redirect khi `result.state === "ok"`.
- `tests/rbac-permissions.spec.ts`
  - Thêm test:
    - `/api/auth/me` không token => `401 AUTH_MISSING_BEARER`
    - `/api/auth/me` token rác => `401 AUTH_INVALID_TOKEN`
    - Token hợp lệ nhưng gọi API không đủ quyền => `403 AUTH_FORBIDDEN`

## Verify steps
1. Chạy lint/build:
   - `npm run lint`
   - `npm run build`
2. Chạy test auth/rbac:
   - `BASE_URL=http://127.0.0.1:3000 npx playwright test tests/rbac-permissions.spec.ts`
3. Smoke manual:
   - Mở `/login` khi chưa đăng nhập: trang login hiển thị bình thường, không redirect loop.
   - Gọi `GET /api/auth/me` không token: nhận `401`.
   - Gọi `GET /api/auth/me` token sai: nhận `401`.
   - User thiếu quyền gọi `GET /api/admin/users`: nhận `403`.

## Verify result
- `npm run lint`: PASS
- `npm run build`: PASS
- Playwright cho file `tests/rbac-permissions.spec.ts`: cần `BASE_URL` đang chạy để thực thi.
