# 🔍 Báo Cáo Kiểm Tra Toàn Bộ Repo – thayduy-crm

**Ngày kiểm tra:** 17/02/2026  
**Phạm vi:** Toàn bộ code, API, UI Landing, Admin, Student Portal  
**Phương pháp:** Code review + ESLint + Browser testing + API curl testing

---

## 1. Tổng Quan

| Hạng mục | Kết quả |
|:---|:---|
| **ESLint** | ✅ 0 lỗi, 1 cảnh báo (unused import `jsonError` trong `tuition-plans/route.ts`) |
| **Build** (`next build`) | ✅ Exit code 0 |
| **Tổng API routes** | 96 routes có xác thực + 22 routes không yêu cầu auth |
| **Landing Page** | ✅ 11/11 sections hoạt động tốt |
| **Admin Login** | ✅ Hiển thị đúng, redirect auth hoạt động |
| **Student Portal** | ✅ Login/Register/Dashboard hoạt động |
| **Auth Guard** | ✅ `/dashboard`, `/leads` redirect → `/login` khi chưa đăng nhập |

---

## 2. Vấn Đề Bảo Mật

### 🔴 Nghiêm trọng

| # | Vấn đề | File | Chi tiết |
|:---|:---|:---|:---|
| S1 | **`/api/public/seed-tuition` không có bảo mật** | [route.ts](file:///Volumes/Data%20-%203/thayduy-crm/src/app/api/public/seed-tuition/route.ts) | Endpoint `POST` public không yêu cầu auth. Bất kỳ ai cũng có thể gọi để **ghi đè toàn bộ bảng giá**. Khi DB không chạy, trả về lỗi Prisma nội bộ (leak thông tin). |
| S2 | **Endpoint seed-tuition leak lỗi Prisma** | Cùng file | Response trả nguyên nội dung `error.message` chứa đường dẫn file server. |

> [!CAUTION]
> **Đề xuất:** Xoá hoặc chuyển `/api/public/seed-tuition` thành endpoint admin-only có auth.

### 🟡 Trung bình

| # | Vấn đề | Chi tiết |
|:---|:---|:---|
| S3 | **20+ API routes dùng `catch {}` trống** | Không log lỗi → khó debug khi production gặp sự cố |
| S4 | **Không có rate limiting trên login endpoints** | `/api/auth/login`, `/api/student/auth/login`, `/api/student/auth/register` không giới hạn tần suất request → nguy cơ brute-force |
| S5 | **Endpoint health/db trả chi tiết lỗi** | Nên ẩn chi tiết thêm trong production |

### 🟢 Thấp

| # | Vấn đề | Chi tiết |
|:---|:---|:---|
| S6 | **Webhook routes dùng secret header** | OK pattern, cần đảm bảo secrets được set trong `.env` |

---

## 3. Kiểm Tra Tính Năng UI (Browser)

### Landing Page

| STT | Section | Trạng thái | Ghi chú |
|:---|:---|:---|:---|
| 1 | Header (logo, hotline, nút) | ✅ OK | Hotline 0948 742 666 hiển thị đúng |
| 2 | Hero Section | ✅ OK | CTA "ĐĂNG KÝ NGAY" + "XEM HỌC PHÍ" |
| 3 | Bảng Giá Học Phí | ✅ OK | Filter tỉnh/thành hoạt động, giá cập nhật đúng |
| 4 | Trọn gói gồm gì? | ✅ OK | |
| 5 | Tiến trình thanh toán | ✅ OK | 3 bước |
| 6 | Quy trình nâng hạng | ✅ OK | 5 bước, pill "Có thể dời lịch", info box |
| 7 | Lộ trình đào tạo | ✅ OK | 4 bước |
| 8 | Sau khi nộp hồ sơ | ✅ OK | 5 bước khép kín |
| 9 | Công cụ hỗ trợ | ✅ OK | "Cần đăng nhập" thay "Private" |
| 10 | Footer / Form đăng ký | ✅ OK | |
| 11 | Bottom Navigation | ✅ OK | 4 icon |

### Admin Module

| Tính năng | Trạng thái | Ghi chú |
|:---|:---|:---|
| Login page (`/login`) | ✅ OK | Username/email + password |
| Auth guard redirect | ✅ OK | `/dashboard`, `/leads` → `/login` |
| API `GET /api/leads` (no auth) | ✅ OK | Trả `AUTH_MISSING_BEARER` |

### Student Portal

| Tính năng | Trạng thái | Ghi chú |
|:---|:---|:---|
| Login (`/student/login`) | ✅ OK | Label "Số điện thoại / Email" |
| Register (`/student/register`) | ✅ OK | Mã HV, mã hồ sơ, SĐT, mật khẩu |
| API login nhận `identifier` | ✅ OK | Fallback Lead.phone |

---

## 4. Code Quality

### Tốt ✅
- **RBAC theo module/action** via `requirePermissionRouteAuth`
- **Scope filtering** — telesales chỉ thấy leads của mình
- **Idempotency keys** — receipts, AI ingest, outbound
- **Transaction-safe** — lead creation dùng `prisma.$transaction`
- **Input validation** — date, phone regex, amount checks
- **Honeypot anti-spam** trên form lead công khai
- **Error messages tiếng Việt** (`API_ERROR_VI`)

### Cần cải thiện ⚠️
- `parsePagination` duplicate giữa leads và receipts → extract utility
- `SEED_PLANS` khác nhau giữa 2 file (30 vs 21 plans)
- Admin pages JSX dài (200+ dòng) → nên tách sub-components

---

## 5. Logic Nghiệp Vụ Admin

| Module | Đánh giá | Ghi chú |
|:---|:---|:---|
| **Leads** | ✅ Chặt chẽ | Auto-status, event logging, phone validation, scope filter |
| **Students** | ✅ OK | Lead → Student → Course, quản lý trạng thái |
| **Receipts** | ✅ OK | Idempotency, scope check, VN timezone |
| **Instructors** | ✅ OK | CRUD, assign, change-instructor event logging |
| **Practical Lessons** | ✅ OK | Overlap detection, soft-cancel |
| **KPI** | ✅ OK | Daily metrics, targets by role/branch |
| **Outbound** | ✅ OK | Message queue, retry backoff, callback |
| **Courses** | ✅ OK | Schedule items, student enrollment |
| **Authentication** | ✅ OK | JWT + refresh, separate admin/student flows |
| **Permissions** | ✅ OK | Module-level RBAC with permission groups |

---

## 6. Đề Xuất Hành Động (Ưu tiên)

### 🔴 Ưu tiên cao

| # | Đề xuất | Lý do |
|:---|:---|:---|
| 1 | **Xoá `/api/public/seed-tuition`** | Public, ghi DB, leak lỗi |
| 2 | **Thêm `console.error` vào `catch {}` blocks** | 20+ routes nuốt lỗi |
| 3 | **Rate limiting cho login endpoints** | Ngăn brute-force |

### 🟡 Ưu tiên trung bình

| # | Đề xuất | Lý do |
|:---|:---|:---|
| 4 | Extract `parsePagination` → shared utility | Tránh duplicate |
| 5 | Thống nhất `SEED_PLANS` data | 2 file khác data |
| 6 | Rate limit `/api/public/lead` | Anti-spam bổ sung |
| 7 | Loading spinner khi đổi tỉnh ở bảng giá | UX |

### 🟢 Ưu tiên thấp

| # | Đề xuất | Lý do |
|:---|:---|:---|
| 8 | Tách JSX admin pages thành sub-components | Readability |
| 9 | Thêm E2E tests cho admin flows | Hiện chỉ có landing tests |
| 10 | Setup CI/CD lint + build | Ngăn regression |

---

## 7. Kết Luận

> **Hệ thống có kiến trúc tốt** với RBAC, scope filtering, idempotency, và validation đầy đủ. Có 3 vấn đề bảo mật cần xử lý ngay (S1: xoá seed endpoint, S3: error logging, S4: rate limiting). UI Landing hoạt động hoàn hảo. Admin auth guard đúng pattern. **Overall quality: 8/10**.
