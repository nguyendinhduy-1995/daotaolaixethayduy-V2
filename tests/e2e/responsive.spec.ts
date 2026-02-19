/**
 * Responsive E2E Tests — Desktop + iPhone viewport
 * Validates critical CRM flows work on both screen sizes.
 * Uses single login per viewport group and navigates without re-login.
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const SNAP_DIR = path.join(process.cwd(), "docs/e2e-snapshots");
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "nguyendinhduy@gmail.com";
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || "Nguyendinhduy@95";

test.beforeAll(() => {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
});

async function doLogin(page: Page) {
    await page.goto("/login");
    await page.waitForSelector("#login-account", { timeout: 10_000 });
    await page.fill("#login-account", ADMIN_EMAIL);
    await page.fill("#login-password", ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/leads**", { timeout: 30_000 });
}

// ─── Desktop Tests ──────────────────────────────────
test.describe("Desktop (1280×720)", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("desktop — login + leads + receipts", async ({ page }) => {
        await doLogin(page);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(/leads/);
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-desktop-leads.png"), fullPage: true });

        await page.goto("/leads");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText("500");
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-desktop-leads-page.png") });

        await page.goto("/receipts");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText("500");
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-desktop-receipts.png") });
    });
});

// ─── iPhone Tests ───────────────────────────────────
test.describe("iPhone (375×812)", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("iPhone — login + leads + receipts", async ({ page }) => {
        await doLogin(page);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(/leads/);
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-iphone-leads.png"), fullPage: true });

        await page.goto("/leads");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText("500");
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-iphone-leads-page.png") });

        await page.goto("/receipts");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText("500");
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-iphone-receipts.png") });
    });
});
