import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error(
    'Thiếu BASE_URL cho Playwright. Hãy chạy `npm run test:e2e` hoặc set BASE_URL thủ công.'
  );
}

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
});
