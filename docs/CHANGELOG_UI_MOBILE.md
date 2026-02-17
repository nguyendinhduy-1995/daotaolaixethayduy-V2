# CHANGELOG_UI_MOBILE

## 1) Summary (what/why)
- Chuẩn hóa mobile theo hướng iOS/Notion và chuyển điều hướng mobile sang 1 cụm nút cố định phía dưới: `Menu` + `+ Thêm`.
- Tạo single-source menu admin tại `src/lib/admin-menu.ts` để gom toàn bộ route quản trị/tác vụ vào một nơi.
- Loại bỏ bottom tab bar cũ, thay bằng Mobile Admin Menu có tìm kiếm không dấu theo `label + keywords`.
- Dọn text hiển thị theo tiếng Việt, ưu tiên thay các cụm liên quan `Lead/Dashboard/Search/Filter/Detail`.

## 2) Files added
- `src/lib/app-meta.ts`
- `src/lib/ui-text.vi.ts`
- `src/lib/admin-menu.ts`
- `src/components/mobile/MobileShell.tsx`
- `src/components/mobile/SuggestedChecklist.tsx`
- `src/components/mobile/MobileAdminMenu.tsx`
- `UI_VIETNAMESE_AUDIT.md`
- `playwright.config.ts`
- `tests/mobile-smoke.spec.ts`
- `tests/artifacts/mobile-login.png`
- `tests/artifacts/mobile-dashboard.png`
- `tests/artifacts/mobile-leads.png`
- `tests/artifacts/mobile-kpi.png`

## 3) Files modified
- `src/app/layout.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/student/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/globals.css`
- `src/components/mobile/MobileTopbar.tsx`
- `src/components/ui/bottom-sheet.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/leads/page.tsx`
- `src/app/(app)/leads/board/page.tsx`
- `src/app/(app)/kpi/daily/page.tsx`
- `src/app/(app)/automation/run/page.tsx`
- `package.json`
- `package-lock.json`

## 4) Brand string replacements (pattern/điểm quan trọng)
- Rebrand hiển thị thống nhất qua constants:
  - `APP_NAME = Thầy Duy Đào Tạo Lái Xe`
  - `APP_SHORT = Thầy Duy`
  - `APP_DESCRIPTION = CRM & vận hành đào tạo lái xe`
- Các cụm hiển thị đã chuẩn hóa:
  - `Lead/Leads` -> `Khách hàng`
  - `Dashboard` -> `Trang chủ`
  - `Search` -> `Tìm kiếm`
  - `Filter` -> `Bộ lọc`
  - `Detail` -> `Chi tiết`
  - `Verify Lead` -> `Xác minh khách hàng` (không tìm thấy chuỗi này trong UI hiện tại)
- Kiểm tra rebrand:
  - `rg -n "thayduyCRM" src` -> không có match

## 5) Mobile UX notes (topbar, bottom nav/menu, safe area, blur, checklist)
- `MobileShell`:
  - Gỡ hoàn toàn tab bar cũ.
  - Tăng `padding-bottom` theo `safe-area` để không che nội dung.
- `MobileAdminMenu`:
  - Nút `Menu` fixed bottom mở sheet `Menu quản trị`.
  - Tìm kiếm `Tìm tính năng...`, lọc theo `label + keywords`, có normalize tiếng Việt không dấu.
  - Hiển thị theo group: `Tổng quan`, `Khách hàng`, `Doanh thu`, `Đào tạo`, `Tự động hóa`, `Quản trị`.
  - Highlight route đang active, tap feedback `active:scale-[0.98]`.
- Nút `+ Thêm`:
  - Action sheet gồm các mục có route thực tế: `Tạo khách hàng`, `Tạo phiếu thu`, `Tạo học viên`.
- `MobileTopbar`:
  - Hỗ trợ ẩn nút menu topbar để tránh trùng điều hướng (giữ 1 điểm vào menu ở nút fixed bottom).

## 6) How to verify (manual + route)
- Chạy app dev và mở mobile viewport (iPhone 13):
  - `/dashboard`
  - `/leads`
  - `/leads/board`
  - `/kpi/daily`
- Kiểm tra:
  - Có cụm nút dưới cùng `Menu` và `+ Thêm`.
  - Bấm `Menu` mở sheet, search 2-3 ký tự tìm được route.
  - Bấm item điều hướng đúng route và tự đóng sheet.
  - Nội dung không bị che bởi cụm nút dưới (đã có safe-area padding).

## 7) Kết quả lint/build/playwright
- `npm run lint` -> **PASS**
- `npm run build` -> **PASS**
- `npx playwright test` -> **PASS (2 passed)**
  - Artifacts:
    - `tests/artifacts/mobile-login.png`
    - `tests/artifacts/mobile-dashboard.png`
    - `tests/artifacts/mobile-leads.png`
    - `tests/artifacts/mobile-kpi.png`

## 8) Route -> label mapping (ADMIN_MENU)
- Cấu hình tại: `src/lib/admin-menu.ts`
- Nhóm chính đã map:
  - Tổng quan: `Trang chủ`, `KPI`, `Thông báo`
  - Khách hàng: `Khách hàng`, `Bảng trạng thái khách hàng`, `Gọi ra / Outbound`
  - Doanh thu: `Phiếu thu`, `Lương của tôi`, `Bảng lương`, `KPI nhân sự`
  - Đào tạo: `Học viên`, `Khóa học`, `Lịch học`, `Nội dung học viên`
  - Tự động hóa: `Tự động hóa`, `Nhật ký tự động hóa`, `Vận hành tự động`, `Lập lịch`, `Tiến trình gửi tin`, `Luồng n8n`, `Báo cáo`, `Báo cáo marketing`
  - Quản trị: `Người dùng`, `Chi nhánh`, `Phân khách hàng`, `Quản trị thông báo`, `Gói học phí`, `Chấm công`, `Hồ sơ lương`

## 9) TODO nếu route chưa rõ / next improvements
- `admin/worker`, `admin/cron`, `admin/scheduler` đã gán label theo ngữ cảnh; nếu nghiệp vụ đổi tên, chỉ cần sửa tại `src/lib/admin-menu.ts`.
- Bổ sung phân quyền hiển thị menu theo role ngay trong `ADMIN_MENU` (hiện tại hiển thị theo route config chung).
- Mở rộng rà soát chuỗi tiếng Anh còn lại ở toàn bộ màn admin cũ, đặc biệt các thông báo lỗi server trả về trực tiếp.
