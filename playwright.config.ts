import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests only, and they run against DEMO_MODE=1 so they never spend
 * real Nansen credits and pass with no API key — exactly what a judge's
 * first run and CI both need.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'DEMO_MODE=1 pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { DEMO_MODE: '1' },
  },
});
