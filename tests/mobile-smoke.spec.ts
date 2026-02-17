import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL || 'admin@thayduy.local';
const ADMIN_PASSWORD = process.env.PW_ADMIN_PASSWORD || 'Admin@123456';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await expect(page.getByText('Thầy Duy Đào Tạo Lái Xe')).toBeVisible();
  await page.getByLabel('Tài khoản (username hoặc email)').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/leads');
}

test('Trang đăng nhập hiển thị đúng brand', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Thầy Duy Đào Tạo Lái Xe')).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/mobile-login.png', fullPage: true });
});

test('Mobile shell hiển thị topbar + menu dưới ở dashboard/leads/kpi', async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto('/dashboard');
  await expect(page.locator('header.ios-glass').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' }).first()).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/mobile-dashboard.png', fullPage: true });

  await page.goto('/leads');
  await expect(page.locator('header.ios-glass').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' }).first()).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/mobile-leads.png', fullPage: true });

  await page.goto('/kpi/daily');
  await expect(page.locator('header.ios-glass').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' }).first()).toBeVisible();
  await page.screenshot({ path: 'tests/artifacts/mobile-kpi.png', fullPage: true });
});
