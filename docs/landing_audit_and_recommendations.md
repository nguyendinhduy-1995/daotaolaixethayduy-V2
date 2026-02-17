# Landing Audit & Recommendations – BƯỚC 3

## Tổng quan thay đổi

BƯỚC 3 triển khai 5 mục chính: Auth entry pages, Miniapp private modal, Auto-seed tuition plans, UI polish pass, và Verification scripts.

## Checklist hoàn thành

### A) Student Auth Entry ✅
- `/student/login` – Premium Navy/Amber, form phone+password → API `/api/student/auth/login`
- `/student/register` – Form studentId/profileCode+phone+password, note đjj "cần mã từ nhà trường"
- Không 404, UI đồng nhất với landing

### B) Miniapp Hub + Modal ✅
- Tập Lái / Mô Phỏng = **Public** → mở trực tiếp taplai subdomain
- Lịch Học / Ngày Thi = **Private** → mở modal "Yêu cầu đăng nhập"
- Modal: rounded-2xl, backdrop-blur-sm, ESC + click-outside close

### C) Auto-Seed ✅
- API `/api/public/tuition-plans` auto-seed khi DB trống (non-production OR `ALLOW_AUTO_SEED=true`)
- 10 tỉnh × 3 hạng = 30 records (idempotent upsert)
- Script CLI: `npm run seed:tuition`
- Empty state: CTA "Chọn tỉnh khác" + "Nhắn Zalo hỏi giá"

### D) UI Polish Pass ✅
- Primary amber `#F59E0B`, hover `#D97706`
- Text: `slate-900` / `slate-600`
- Container: `max-w-[1040px]`, padding `px-4`
- Border: `border-slate-200/60`, shadow: `shadow-sm`
- Header: `fixed` + `bg-white/70` + `backdrop-blur-lg`
- H1: `text-[28px] md:text-[34px] font-semibold tracking-tight`
- Section titles: `text-lg md:text-xl font-semibold`
- Main padding: `pt-[52px] pb-[88px] md:pb-0`
- Pricing: card layout (no table) trên mobile

### E) Test Results ✅
| Command | Result |
|---------|--------|
| `npm run build` | ✅ Exit code 0 |

## Rủi ro / Edge Cases

1. **Cookie domain**: Student auth cookie cần `domain=.thayduydaotaolaixe.com` nếu CRM và Landing dùng subdomain khác nhau
2. **RBAC**: Register API yêu cầu student đã tồn tại (admin-created) – không phải public self-signup
3. **Auto-seed race**: Nếu nhiều request đồng thời khi DB trống, upsert vẫn idempotent nên an toàn
4. **PricingSection filter**: Nếu user chọn tỉnh không có data (edge), empty state hiển thị tốt

## Đề xuất tối ưu tiếp

1. **SEO/OG tags**: Thêm Open Graph meta cho landing (title, description, image) trong `layout.tsx`
2. **Analytics events**: Track CTA clicks, form submissions bằng Google Analytics / Facebook Pixel
3. **CRM namespace**: Migrate CRM routes sang `/crm/*` để tách biệt rõ landing vs CRM
4. **Nginx mapping**: Cấu hình subdomain `crm.thayduydaotaolaixe.com → /crm/*` redirect
5. **Performance**: Lazy-load components dưới fold (`dynamic()` Next.js)
6. **Accessibility**: Thêm `aria-label` cho interactive elements, keyboard navigation
7. **PWA**: Thêm `manifest.json` + service worker cho offline caching
8. **Monitoring**: Sentry / error boundary cho client-side errors

## Danh sách file thay đổi

| Action | File |
|--------|------|
| MODIFY | `src/app/student/login/page.tsx` |
| MODIFY | `src/app/student/register/page.tsx` |
| MODIFY | `src/app/(landing)/page.tsx` |
| MODIFY | `src/app/(landing)/_components/LandingStyles.tsx` |
| MODIFY | `src/app/(landing)/_components/HeaderBar.tsx` |
| MODIFY | `src/app/(landing)/_components/HeroSection.tsx` |
| MODIFY | `src/app/(landing)/_components/PricingSection.tsx` |
| MODIFY | `src/app/(landing)/_components/PackageIncludes.tsx` |
| MODIFY | `src/app/(landing)/_components/PaymentSteps.tsx` |
| MODIFY | `src/app/(landing)/_components/TrainingRoadmap.tsx` |
| MODIFY | `src/app/(landing)/_components/UpgradeProcess.tsx` |
| MODIFY | `src/app/(landing)/_components/PostEnrollRoadmap.tsx` |
| MODIFY | `src/app/(landing)/_components/ToolsHub.tsx` |
| MODIFY | `src/app/(landing)/_components/LeadForm.tsx` |
| MODIFY | `src/app/(landing)/_components/FooterCTA.tsx` |
| MODIFY | `src/app/(landing)/_components/BottomNav.tsx` |
| MODIFY | `src/app/api/public/tuition-plans/route.ts` |
| MODIFY | `package.json` |
| NEW | `scripts/seed-tuition-plans.ts` |
| NEW | `scripts/verify-full.sh` |
| NEW | `docs/landing_audit_and_recommendations.md` |
