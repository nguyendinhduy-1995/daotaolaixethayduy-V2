# CHANGELOG_SPINNER_LOOP_FIX

## Summary
- Sửa vòng lặp spinner/redirect ở frontend khi chưa đăng nhập.
- Chuẩn hóa luồng guard cho 3 route trọng điểm: `/`, `/login`, `/api-hub`.
- Thêm logging tối thiểu cho auth guard khi bật `DEBUG=1`.

## Route triage
- `/`:
  - Root cause: `src/app/page.tsx` gọi `guardByAuthMe(router).then((user) => { if (user) ... })` theo kiểu cũ.
  - Sau khi `guardByAuthMe` đổi sang trả `AuthGuardResult`, điều kiện `if (user)` luôn truthy => redirect chồng, dễ loop.
- `/login`:
  - Đã tránh redirect khi 401, nhưng effect có thể chạy lặp trong Strict Mode.
- `/api-hub`:
  - Có fetch quyền riêng qua `/api/auth/me`; chưa phân nhánh rõ 401/403 và chưa khóa effect chạy 1 lần.

## Files changed
- `src/app/page.tsx`
  - Sửa xử lý `AuthGuardResult` đúng trạng thái (`ok/unauthorized/forbidden/error`).
  - Thêm `useRef` lock để guard chỉ chạy 1 lần.
  - Thêm fallback UI lỗi + nút `Thử lại`.
- `src/app/login/page.tsx`
  - Thêm `useRef` lock, guard chỉ chạy 1 lần.
  - Giữ nguyên rule: ở `/login`, 401 không redirect vòng.
- `src/app/(app)/layout.tsx`
  - Thêm `useRef` lock cho guard chạy 1 lần.
  - Bổ sung UI rõ ràng khi state `unauthorized` (không spinner vô hạn).
- `src/app/(app)/api-hub/page.tsx`
  - Thêm `useRef` lock cho permission check.
  - 401 => redirect `/login` một lần.
  - 403 => hiển thị `Bạn không có quyền truy cập`.
  - Lỗi mạng/timeout => hiển thị lỗi + nút `Thử lại`.
- `src/lib/ui-auth-guard.ts`
  - Thêm debug logging state transitions khi `DEBUG=1` (`NEXT_PUBLIC_DEBUG=1` hoặc query `?DEBUG=1` hoặc localStorage `DEBUG=1`).
- `tests/rbac-permissions.spec.ts`
  - Thêm test:
    - `/login` unauthenticated render ổn định, không vòng lặp điều hướng.
    - `/dashboard` unauthenticated redirect `/login` một lần.

## Verify steps
1. `npm run lint`
2. `npm run build`
3. `npm run dev`
4. Playwright smoke:
   - `BASE_URL=http://127.0.0.1:3000 npx playwright test tests/rbac-permissions.spec.ts`

## Verify result
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run dev`: PASS (smoke log: `Ready` tại `http://127.0.0.1:3000`)
- `BASE_URL=http://127.0.0.1:3000 npx playwright test tests/rbac-permissions.spec.ts`: FAIL do môi trường sandbox (`connect EPERM 127.0.0.1:3000`, Chromium launch `Permission denied (1100)`), không phải lỗi logic ứng dụng.
