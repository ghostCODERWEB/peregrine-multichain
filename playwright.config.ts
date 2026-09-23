import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests only, and they run against DEMO_MODE=1 (pnpm dev:demo) so
 * they never spend real Nansen credits and pass with no API key — exactly
 * what a judge's first run and CI both need.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/warmup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 90_000,
  use: {
    // E2E_URL points the suite at an already-running instance (e.g. a
    // production build of the demo); otherwise it starts `pnpm dev:demo`.
    baseURL: process.env.E2E_URL ?? 'http://localhost:3300',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: process.env.E2E_URL ? undefined : {
    command: 'pnpm dev:demo',
    url: 'http://localhost:3300',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
