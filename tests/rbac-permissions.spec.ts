import { expect, test, type APIRequestContext } from '@playwright/test';

const ADMIN_EMAIL = process.env.PW_ADMIN_EMAIL || 'admin@thayduy.local';
const ADMIN_PASSWORD = process.env.PW_ADMIN_PASSWORD || 'Admin@123456';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

function apiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

async function loginApi(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(apiUrl('/api/auth/login'), { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const token = body.accessToken || body.token;
  expect(token).toBeTruthy();
  return token as string;
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('Tài khoản (username hoặc email)').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/leads');
}

test('Route thiếu mapping quyền bị chặn mặc định 403', async ({ request }) => {
  const res = await request.get(apiUrl('/api/_rbac_unmapped_probe'));
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body?.error?.code).toBe('AUTH_FORBIDDEN');
});

test('Route allowlist public/secret vẫn chạy auth riêng, không bị chặn bởi RBAC middleware', async ({ request }) => {
  const publicRes = await request.post(apiUrl('/api/auth/login'), { data: {} });
  expect(publicRes.status()).toBe(400);
  const publicBody = await publicRes.json();
  expect(publicBody?.error?.code).not.toBe('AUTH_FORBIDDEN');

  const secretRes = await request.post(apiUrl('/api/outbound/callback'), {
    data: { messageId: 'x', status: 'SENT' },
  });
  expect(secretRes.status()).toBe(401);
  const secretBody = await secretRes.json();
  expect(secretBody?.error?.code).not.toBe('AUTH_FORBIDDEN');
});

test('AUTH /api/auth/me: không có token trả 401', async ({ request }) => {
  const res = await request.get(apiUrl('/api/auth/me'));
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body?.error?.code).toBe('AUTH_MISSING_BEARER');
});

test('AUTH /api/auth/me: token rác trả 401', async ({ request }) => {
  const res = await request.get(apiUrl('/api/auth/me'), {
    headers: { Authorization: 'Bearer token-rac-khong-hop-le' },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body?.error?.code).toBe('AUTH_INVALID_TOKEN');
});

test('AUTHZ: token hợp lệ nhưng thiếu quyền trả 403', async ({ request }) => {
  const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const email = `viewer-authz-${Date.now()}@thayduy.local`;
  const password = 'Viewer@123456';

  const createRes = await request.post(apiUrl('/api/users'), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Viewer Authz',
      email,
      password,
      role: 'viewer',
      isActive: true,
    },
  });
  expect(createRes.ok()).toBeTruthy();

  const viewerToken = await loginApi(request, email, password);
  const deniedRes = await request.get(apiUrl('/api/admin/users?page=1&pageSize=10'), {
    headers: { Authorization: `Bearer ${viewerToken}` },
  });
  expect(deniedRes.status()).toBe(403);
  const deniedBody = await deniedRes.json();
  expect(deniedBody?.error?.code).toBe('AUTH_FORBIDDEN');
});

test('UI /login: chưa đăng nhập vẫn render bình thường, không vòng lặp điều hướng', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/login$/);
});

test('UI route bảo vệ: chưa đăng nhập truy cập /dashboard thì chuyển /login một lần', async ({ page }) => {
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigations.push(frame.url());
    }
  });

  await page.goto(`${BASE_URL}/dashboard`);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();

  await page.waitForTimeout(1000);
  const loginHits = navigations.filter((url) => url.includes('/login')).length;
  expect(loginHits).toBeLessThanOrEqual(1);
});

test('User không có quyền admin_users sẽ bị ẩn menu và API trả 403', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  const email = `viewer-rbac-${Date.now()}@thayduy.local`;
  const password = 'Viewer@123456';

  const createRes = await page.context().request.post(apiUrl('/api/users'), {
    data: {
      name: 'Viewer RBAC',
      email,
      password,
      role: 'viewer',
      isActive: true,
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();

  const overrideRes = await page.context().request.put(apiUrl(`/api/admin/users/${created.user.id}/permission-overrides`), {
    data: {
      groupId: null,
      overrides: [{ module: 'admin_users', action: 'VIEW', allowed: false }],
    },
  });
  expect(overrideRes.ok()).toBeTruthy();

  await page.context().request.post(apiUrl('/api/auth/logout'));
  await login(page, email, password);

  await page.getByRole('button', { name: 'Menu' }).first().click();
  await expect(page.getByText('Menu quản trị')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Người dùng' })).toHaveCount(0);

  const denied = await page.context().request.get(apiUrl('/api/admin/users?page=1&pageSize=10'));
  expect(denied.status()).toBe(403);
});

test('Admin full quyền gọi API admin_users thành công', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  const res = await page.context().request.get(apiUrl('/api/admin/users?page=1&pageSize=10'));
  expect(res.status()).toBe(200);
});

test('API Hub: admin thấy menu và truy cập được', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Menu' }).first().click();
  await expect(page.getByRole('button', { name: 'API Hub' })).toBeVisible();
  await page.getByRole('button', { name: 'API Hub' }).click();
  await expect(page.getByRole('heading', { name: 'API Hub' })).toBeVisible();
});

test('API Hub: user không có quyền thì ẩn menu và bị chặn ở page', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  const email = `no-apihub-${Date.now()}@thayduy.local`;
  const password = 'Viewer@123456';

  const createRes = await page.context().request.post(apiUrl('/api/users'), {
    data: {
      name: 'No API Hub',
      email,
      password,
      role: 'viewer',
      isActive: true,
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();

  const overrideRes = await page.context().request.put(apiUrl(`/api/admin/users/${created.user.id}/permission-overrides`), {
    data: {
      groupId: null,
      overrides: [{ module: 'api_hub', action: 'VIEW', allowed: false }],
    },
  });
  expect(overrideRes.ok()).toBeTruthy();

  await page.context().request.post(apiUrl('/api/auth/logout'));
  await login(page, email, password);

  await page.getByRole('button', { name: 'Menu' }).first().click();
  await expect(page.getByRole('button', { name: 'API Hub' })).toHaveCount(0);

  await page.goto(`${BASE_URL}/api-hub`);
  await expect(page.getByText('Bạn không có quyền truy cập')).toBeVisible();
});

test('Scope OWNER: user không thấy khách hàng thuộc owner khác', async ({ request }) => {
  const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  const suffix = Date.now();
  const ownerAEmail = `owner-a-${suffix}@thayduy.local`;
  const ownerBEmail = `owner-b-${suffix}@thayduy.local`;
  const password = 'Owner@123456';

  const createOwnerA = await request.post(apiUrl('/api/users'), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: 'Owner A', email: ownerAEmail, password, role: 'telesales', isActive: true },
  });
  expect(createOwnerA.ok()).toBeTruthy();
  const ownerA = (await createOwnerA.json()).user;

  const createOwnerB = await request.post(apiUrl('/api/users'), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: 'Owner B', email: ownerBEmail, password, role: 'telesales', isActive: true },
  });
  expect(createOwnerB.ok()).toBeTruthy();
  await createOwnerB.json();

  const createLead = await request.post(apiUrl('/api/leads'), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { fullName: `Khách test ${suffix}`, phone: `090${String(suffix).slice(-7)}` },
  });
  expect(createLead.ok()).toBeTruthy();
  const leadId = (await createLead.json()).lead.id as string;

  const assignLead = await request.post(apiUrl('/api/leads/assign'), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { leadIds: [leadId], ownerId: ownerA.id },
  });
  expect(assignLead.ok()).toBeTruthy();

  const ownerBToken = await loginApi(request, ownerBEmail, password);
  const ownerBLeadsRes = await request.get(apiUrl('/api/leads?page=1&pageSize=50'), {
    headers: { Authorization: `Bearer ${ownerBToken}` },
  });
  expect(ownerBLeadsRes.status()).toBe(200);
  const ownerBLeads = await ownerBLeadsRes.json();
  const found = (ownerBLeads.items as Array<{ id: string }>).some((item) => item.id === leadId);
  expect(found).toBeFalsy();
});
