# ADMIN_GUIDE_SCREENSHOT_NOTES

## Route cần chụp
- `/admin/guide` (desktop)
- `/admin/guide` (mobile iPhone 13)

## Thành phần UI cần có trên screenshot
1. Header trang:
- Tiêu đề: `Hướng dẫn vận hành Admin`
- Mô tả ngắn tài liệu

2. Ô tìm kiếm:
- Placeholder: `Tìm trong hướng dẫn...`
- Có thể lọc theo từ khóa module

3. Mục lục:
- Danh sách anchor chips tới từng section

4. Section dạng accordion:
- Tiêu đề section
- Badge quyền:
  - `Có quyền truy cập`
  - `Không có quyền truy cập`
- Nội dung chi tiết (markdown text render dạng pre-wrap)

## Route liên quan điều hướng
- Menu sidebar desktop: `Hướng dẫn vận hành` -> `/admin/guide`
- Mobile menu: item `Hướng dẫn vận hành` -> `/admin/guide`

## Ghi chú kiểm thử thủ công
- User đã đăng nhập nhưng thiếu quyền module vẫn mở được guide.
- Section thiếu quyền chỉ hiển thị mô tả, không trả dữ liệu nhạy cảm runtime.
- Search không gây rerender loop/spinner vô hạn.
