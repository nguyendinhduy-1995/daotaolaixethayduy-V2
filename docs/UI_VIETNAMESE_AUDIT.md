# UI_VIETNAMESE_AUDIT

## Mục tiêu audit
- Quét chuỗi tiếng Anh phổ biến trong `src/`.
- Phân loại:
  - `UI text`: nên dịch sang tiếng Việt.
  - `Logic/enum/error code`: không đổi trực tiếp vì ảnh hưởng dữ liệu/contract; chỉ dịch ở lớp hiển thị.

## 1) English strings (UI) đã phát hiện và xử lý
- `Menu` -> `Trình đơn`  
  File: `src/components/mobile/MobileTopbar.tsx`
- `Home` -> `Trang chủ`  
  Files: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/leads/page.tsx`, `src/app/(app)/leads/board/page.tsx`, `src/app/(app)/kpi/daily/page.tsx`
- `Leads` -> `Khách hàng`  
  Files: như trên
- `Kanban` -> `Bảng trạng thái`  
  Files: `src/app/(app)/leads/board/page.tsx`, `src/app/(app)/layout.tsx`
- `Search` -> `Tìm kiếm`  
  Files: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/kpi/daily/page.tsx`
- `Quick Add Lead` -> `Thêm khách nhanh`  
  Files: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/kpi/daily/page.tsx`
- `Filters` -> `Bộ lọc`  
  File: `src/app/(app)/kpi/daily/page.tsx`

## 2) English strings còn lại nhưng thuộc logic/contract (KHÔNG đổi trực tiếp)
- Error/enum nội bộ API:
  - `INVALID_*`, `FORBIDDEN_*`, `NOT_FOUND`, `OWNER_*`, `PAYROLL_*`, `BRANCH_*`, `AUTH_*`
  - Ví dụ file: `src/app/api/leads/[id]/route.ts`, `src/app/api/courses/route.ts`, `src/lib/services/payroll.ts`
- Lý do:
  - Đây là mã logic/contract để phân nhánh xử lý.
  - Đổi trực tiếp có thể làm vỡ hành vi backend hoặc frontend mapping.
- Cách xử lý đúng:
  - Giữ nguyên mã lỗi/enum.
  - Dịch ở lớp hiển thị bằng map thông điệp tiếng Việt (`src/lib/error-messages-vi.ts` và UI mapping theo status).

## 3) Điểm cần theo dõi tiếp
- Một số text tiếng Anh trong docs/nội dung kỹ thuật (không phải UI runtime) chưa cần thay ngay.
- Nếu mở rộng i18n toàn hệ thống, ưu tiên map thêm tất cả `error.code` -> thông điệp Việt tại UI client.
