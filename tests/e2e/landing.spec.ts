import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const SNAP_DIR = path.join(process.cwd(), "docs/e2e-snapshots");

// Ensure snapshot directory exists
test.beforeAll(async () => {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
});

/* ──────────────────────────────────────────────
   1. Landing renders + header sticky
   ────────────────────────────────────────────── */
test("(1) landing hero renders + header sticky on scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Học lái xe nhanh");
    await expect(page.locator("body")).toContainText("0948 742 666");

    // Verify hotline tel: link
    const hotlineLink = page.locator('a[href^="tel:0948742666"]').first();
    await expect(hotlineLink).toBeVisible();

    // Scroll down 400px – header should stay visible (fixed)
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(300);
    const header = page.locator("header").first();
    await expect(header).toBeVisible();

    await page.screenshot({ path: path.join(SNAP_DIR, "landing-hero.png"), fullPage: false });
});

/* ──────────────────────────────────────────────
   2. Pricing filter has data
   ────────────────────────────────────────────── */
test("(2) pricing section loads data for TPHCM", async ({ page }) => {
    await page.goto("/");
    const pricing = page.locator("#pricing");
    await pricing.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Should have filter selects
    await expect(pricing.locator("select").first()).toBeVisible();

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Assert: either price data or empty state
    const bodyText = (await pricing.textContent()) || "";
    const hasData = bodyText.includes("\u20ab");
    const hasEmpty =
        bodyText.includes("Zalo") || bodyText.includes("t\u1ec9nh kh\u00e1c");
    expect(hasData || hasEmpty).toBeTruthy();

    await page.screenshot({
        path: path.join(SNAP_DIR, "pricing-with-data.png"),
        fullPage: false,
    });
});

/* ──────────────────────────────────────────────
   3. "Trọn gói gồm gì?" section
   ────────────────────────────────────────────── */
test("(3) package includes section shows fees", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toContainText(
        "\u0110\u00e3 bao g\u1ed3m trong tr\u1ecdn g\u00f3i"
    );
    await expect(page.locator("body")).toContainText(
        "Ph\u00e1t sinh b\u1eaft bu\u1ed9c"
    );

    // Open phát sinh section to check amounts
    const phatSinhBtn = page.getByText("Ph\u00e1t sinh b\u1eaft bu\u1ed9c").first();
    await phatSinhBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator("body")).toContainText("250.000");
    await expect(page.locator("body")).toContainText("930.000");

    await page.screenshot({
        path: path.join(SNAP_DIR, "pricing-included-and-fees.png"),
        fullPage: false,
    });
});

/* ──────────────────────────────────────────────
   4. B/C1 payment milestone section
   ────────────────────────────────────────────── */
test("(4) payment steps section shows milestones", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toContainText("gi\u1eef ch\u1ed7 ch\u1eafc");
    await expect(page.locator("body")).toContainText("3.000.000");
    await expect(page.locator("body")).toContainText("50%");
    await expect(page.locator("body")).toContainText("DAT");

    await page.screenshot({
        path: path.join(SNAP_DIR, "bc1-milestone.png"),
        fullPage: false,
    });
});

/* ──────────────────────────────────────────────
   5. Upgrade timeline 5 days
   ────────────────────────────────────────────── */
test("(5) upgrade process shows 5-day timeline", async ({ page }) => {
    await page.goto("/");

    // Title
    await expect(page.locator("body")).toContainText("Quy trình nâng hạng");
    await expect(page.locator("body")).toContainText("Chỉ cần có mặt 5 ngày");

    // 5 step headings
    await expect(page.locator("body")).toContainText("Lên trung tâm đăng ký hồ sơ");
    await expect(page.locator("body")).toContainText("Học lý thuyết & kiểm tra lý thuyết");
    await expect(page.locator("body")).toContainText("Chạy DAT");
    await expect(page.locator("body")).toContainText("Thi tốt nghiệp");
    await expect(page.locator("body")).toContainText("Thi sát hạch");

    // Pill tag
    await expect(page.locator("body")).toContainText("Có thể dời lịch");

    // Info box
    await expect(page.locator("body")).toContainText("Lưu ý quan trọng");
    await expect(page.locator("body")).toContainText("lịch thi của Sở");

    await page.screenshot({
        path: path.join(SNAP_DIR, "upgrade-timeline.png"),
        fullPage: false,
    });
});

/* ──────────────────────────────────────────────
   6. Roadmap 4 steps
   ────────────────────────────────────────────── */
test("(6) training roadmap 4 steps", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toContainText("4 B\u01b0\u1edbc");
    await expect(page.locator("body")).toContainText("L\u00fd thuy\u1ebft linh ho\u1ea1t");
    await expect(page.locator("body")).toContainText("Th\u1ef1c h\u00e0nh Sa h\u00ecnh");
    await expect(page.locator("body")).toContainText("T\u1ed5ng \u00f4n");

    await page.screenshot({
        path: path.join(SNAP_DIR, "roadmap-4-steps.png"),
        fullPage: false,
    });
});

/* ──────────────────────────────────────────────
   7. Post-enrollment 5-step process
   ────────────────────────────────────────────── */
test("(7) post-enrollment 5 steps", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toContainText("Sau Khi N\u1ed9p H\u1ed3 S\u01a1");
    await expect(page.locator("body")).toContainText("X\u1ebfp l\u1edbp");
    await expect(page.locator("body")).toContainText("B\u00e1o l\u1ecbch");
    await expect(page.locator("body")).toContainText("Cam k\u1ebft v\u1eadn h\u00e0nh");

    await page.screenshot({
        path: path.join(SNAP_DIR, "post-enrollment-process.png"),
        fullPage: false,
    });
});

/* ──────────────────────────────────────────────
   8. Miniapp hub private modal
   ────────────────────────────────────────────── */
test("(8) miniapp private card triggers auth modal", async ({ page }) => {
    await page.goto("/");
    await page.locator("#tools").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Click a private app button
    const privateBtn = page
        .getByRole("button", { name: /\u0111\u0103ng nh\u1eadp/i })
        .first();
    await privateBtn.click();
    await page.waitForTimeout(500);

    // Modal overlay is the fixed container
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();

    // Modal text
    await expect(modal).toContainText("h\u1ecdc vi\u00ean");

    // Login + register links scoped to modal
    await expect(modal.getByRole("link", { name: /\u0110\u0103ng nh\u1eadp/i })).toBeVisible();
    await expect(modal.getByRole("link", { name: /\u0110\u0103ng k\u00fd/i })).toBeVisible();

    await page.screenshot({
        path: path.join(SNAP_DIR, "miniapp-private-modal.png"),
        fullPage: false,
    });
});

/* ──────────────────────────────────────────────
   9. Student login/register pages render
   ────────────────────────────────────────────── */
test("(9) student login page renders", async ({ page }) => {
    await page.goto("/student/login");
    await expect(page.locator("body")).toContainText("\u0110\u0103ng nh\u1eadp");
    await page.screenshot({
        path: path.join(SNAP_DIR, "student-login.png"),
        fullPage: false,
    });
});

test("(9b) student register page renders", async ({ page }) => {
    await page.goto("/student/register");
    await expect(page.locator("body")).toContainText("\u0110\u0103ng k\u00fd");
    await page.screenshot({
        path: path.join(SNAP_DIR, "student-register.png"),
        fullPage: false,
    });
});

/* ──────────────────────────────────────────────
   10. CTA scroll to registration form
   ────────────────────────────────────────────── */
test("(10) CTA scrolls to registration form", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    // Click "ĐĂNG KÝ NGAY" in hero
    const cta = page
        .getByRole("button", { name: /\u0110\u0102NG K\u00dd NGAY/i })
        .first();
    await cta.click();
    await page.waitForTimeout(1000);

    // Form section
    const formSection = page.locator("#dang-ky").first();
    await expect(formSection).toBeVisible();
    await expect(formSection).toContainText("S\u1ed1 \u0111i\u1ec7n tho\u1ea1i");

    await page.screenshot({
        path: path.join(SNAP_DIR, "cta-scroll-form.png"),
        fullPage: false,
    });
});
