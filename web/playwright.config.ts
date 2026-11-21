import fs from 'fs';
import { defineConfig, devices } from '@playwright/test';

const systemChromium = '/usr/bin/chromium';
const resolvedExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (fs.existsSync(systemChromium) ? systemChromium : undefined);

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(resolvedExecutablePath ? { executablePath: resolvedExecutablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
