import { expect, test, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_ACCOUNT = process.env.PW_ADMIN_ACCOUNT || 'Nguyendinhduy';
const ADMIN_PASSWORD = process.env.PW_ADMIN_PASSWORD || 'Nguyendinhduy@95';

function apiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

async function loginApi(request: APIRequestContext, account: string, password: string) {
  const res = await request.post(apiUrl('/api/auth/login'), { data: { account, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const token = body.accessToken || body.token;
  expect(token).toBeTruthy();
  return token as string;
}

test('Login page render ổn định, không loop', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByLabel('Tài khoản (username hoặc email)')).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page).toHaveURL(/\/login$/);
});

test('Đăng nhập admin bằng username thành công', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('Tài khoản (username hoặc email)').fill(ADMIN_ACCOUNT);
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/leads/);
});

test('RBAC deny: viewer bị chặn /api/admin/users', async ({ request }) => {
  const adminToken = await loginApi(request, ADMIN_ACCOUNT, ADMIN_PASSWORD);
  const email = `viewer-v2-${Date.now()}@thayduy.local`;

  const created = await request.post(apiUrl('/api/users'), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email,
      password: 'Viewer@123456',
      role: 'viewer',
      isActive: true,
      name: 'Viewer V2',
    },
  });
  expect(created.ok()).toBeTruthy();

  const viewerToken = await loginApi(request, email, 'Viewer@123456');
  const denied = await request.get(apiUrl('/api/admin/users?page=1&pageSize=10'), {
    headers: { Authorization: `Bearer ${viewerToken}` },
  });
  expect(denied.status()).toBe(403);
});

test('Chi phí: lưu daily và summary tháng phản ánh số liệu', async ({ request }) => {
  const adminToken = await loginApi(request, ADMIN_ACCOUNT, ADMIN_PASSWORD);
  const dayRes = await request.get(apiUrl('/api/expenses/daily?date=2026-02-16'), {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(dayRes.ok()).toBeTruthy();
  const dayBody = await dayRes.json();
  expect(dayBody.items.length).toBeGreaterThan(0);

  const branchId = dayBody.branchId as string;
  const firstCategoryId = dayBody.items[0].categoryId as string;
  const amount = 345678;

  const save = await request.post(apiUrl('/api/expenses/daily'), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      branchId,
      dateKey: '2026-02-16',
      items: [{ categoryId: firstCategoryId, amountVnd: amount, note: 'test-e2e-v2' }],
    },
  });
  expect(save.ok()).toBeTruthy();

  const summaryRes = await request.get(apiUrl('/api/expenses/summary?month=2026-02&branchId=' + branchId), {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(summaryRes.ok()).toBeTruthy();
  const summary = await summaryRes.json();
  expect(summary.expensesTotalVnd).toBeGreaterThan(0);
});
