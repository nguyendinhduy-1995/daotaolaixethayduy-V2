/**
 * Responsive E2E Tests — Desktop + iPhone viewport
 * Validates critical CRM flows work on both screen sizes.
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const SNAP_DIR = path.join(process.cwd(), "docs/e2e-snapshots");
const ADMIN_EMAIL = "admin@thayduy.local";
const ADMIN_PASS = "Admin@123456";

test.beforeAll(() => {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
});

async function doLogin(page: Page) {
    await page.goto("/login");
    await page.fill('input[name="email"], input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"], input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 10_000 });
}

// ─── Desktop Tests ──────────────────────────────────
test.describe("Desktop (1280×720)", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("desktop — login + dashboard", async ({ page }) => {
        await doLogin(page);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(/dashboard/);
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-desktop-dashboard.png"), fullPage: true });
    });

    test("desktop — leads page", async ({ page }) => {
        await doLogin(page);
        await page.goto("/leads");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText("500");
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-desktop-leads.png") });
    });

    test("desktop — receipts page", async ({ page }) => {
        await doLogin(page);
        await page.goto("/receipts");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText("500");
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-desktop-receipts.png") });
    });
});

// ─── iPhone Tests ───────────────────────────────────
test.describe("iPhone (375×812)", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("iPhone — login + dashboard", async ({ page }) => {
        await doLogin(page);
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(/dashboard/);
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-iphone-dashboard.png"), fullPage: true });
    });

    test("iPhone — leads page", async ({ page }) => {
        await doLogin(page);
        await page.goto("/leads");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText("500");
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-iphone-leads.png") });
    });

    test("iPhone — receipts page", async ({ page }) => {
        await doLogin(page);
        await page.goto("/receipts");
        await page.waitForLoadState("networkidle");
        await expect(page.locator("body")).not.toContainText("500");
        await page.screenshot({ path: path.join(SNAP_DIR, "responsive-iphone-receipts.png") });
    });
});
