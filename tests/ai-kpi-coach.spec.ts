import { expect, test, type APIRequestContext } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const ADMIN_ACCOUNT = process.env.PW_ADMIN_ACCOUNT || "Nguyendinhduy";
const ADMIN_PASSWORD = process.env.PW_ADMIN_PASSWORD || "Nguyendinhduy@95";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN_ACTIVE || process.env.SERVICE_TOKEN_NEXT || "";

function apiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

async function loginApi(request: APIRequestContext, account: string, password: string) {
  const res = await request.post(apiUrl("/api/auth/login"), { data: { email: account, password } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.accessToken || body.token) as string;
}

test("AI ingest không có service token bị từ chối", async ({ request }) => {
  const res = await request.post(apiUrl("/api/ai/suggestions/ingest"), {
    headers: { "Idempotency-Key": `no-token-${Date.now()}` },
    data: { source: "n8n", runId: `run-${Date.now()}`, suggestions: [] },
  });
  expect(res.status()).toBe(403);
});

test("AI ingest có service token được chấp nhận", async ({ request }) => {
  test.skip(!SERVICE_TOKEN, "Không có SERVICE_TOKEN_ACTIVE/SERVICE_TOKEN_NEXT trong môi trường test");

  const res = await request.post(apiUrl("/api/ai/suggestions/ingest"), {
    headers: {
      "x-service-token": SERVICE_TOKEN,
      "Idempotency-Key": `ai-ingest-${Date.now()}`,
    },
    data: {
      source: "n8n",
      runId: `run-${Date.now()}`,
      suggestions: [
        {
          dateKey: "2026-02-16",
          role: "telesales",
          scoreColor: "YELLOW",
          title: "Test ingest AI",
          content: "Nội dung test ingest",
          actionsJson: [],
          metricsJson: { gap: 1 },
        },
      ],
    },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBeTruthy();
});

test("Targets upsert + goals upsert hoạt động", async ({ request }) => {
  const adminToken = await loginApi(request, ADMIN_ACCOUNT, ADMIN_PASSWORD);

  const branchRes = await request.get(apiUrl("/api/admin/branches"), {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(branchRes.ok()).toBeTruthy();
  const branchData = await branchRes.json();
  const branchId = branchData.items?.[0]?.id as string;
  expect(branchId).toBeTruthy();

  const targetRes = await request.post(apiUrl("/api/kpi/targets"), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      branchId,
      items: [{ role: "telesales", metricKey: "appointed_rate_pct", targetValue: 44, dayOfWeek: null, isActive: true }],
    },
  });
  expect(targetRes.status()).toBe(200);

  const today = "2026-02-16";
  const goalDaily = await request.post(apiUrl("/api/goals"), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      periodType: "DAILY",
      branchId,
      dateKey: today,
      revenueTarget: 55000000,
      dossierTarget: 17,
      costTarget: 13000000,
      note: "Mục tiêu ngày test",
    },
  });
  expect(goalDaily.status()).toBe(200);

  const goalMonthly = await request.post(apiUrl("/api/goals"), {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      periodType: "MONTHLY",
      branchId,
      monthKey: "2026-02",
      revenueTarget: 1300000000,
      dossierTarget: 390,
      costTarget: 300000000,
      note: "Mục tiêu tháng test",
    },
  });
  expect(goalMonthly.status()).toBe(200);
});

test("Trang AI KPI Coach tải được và tạo outbound job từ action", async ({ page, request }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Tài khoản (username hoặc email)").fill(ADMIN_ACCOUNT);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/leads");

  await page.goto(`${BASE_URL}/ai/kpi-coach`);
  await expect(page.getByText("Trợ lý công việc")).toBeVisible();

  const adminToken = await loginApi(request, ADMIN_ACCOUNT, ADMIN_PASSWORD);
  const leadsRes = await request.get(apiUrl("/api/leads?page=1&pageSize=1"), {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(leadsRes.ok()).toBeTruthy();
  const leadsData = await leadsRes.json();
  const leadId = leadsData.items?.[0]?.id as string;
  expect(leadId).toBeTruthy();

  const jobRes = await request.post(apiUrl("/api/outbound/jobs"), {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Idempotency-Key": `outbound-job-${Date.now()}`,
    },
    data: {
      channel: "CALL_NOTE",
      templateKey: "remind_schedule",
      leadId,
      note: "Tạo từ smoke test",
    },
  });
  expect(jobRes.status()).toBe(200);
  const jobBody = await jobRes.json();
  expect(jobBody?.outboundMessage?.status).toBe("QUEUED");
});
