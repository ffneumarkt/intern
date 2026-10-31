import { randomBytes } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

// The superuser of the throwaway e2e server: e2e/server.mjs creates it, e2e/global-setup.ts logs in
// with it. Set once in the runner process; workers inherit the environment.
process.env.E2E_SUPERUSER_EMAIL ??= 'e2e@example.com'
process.env.E2E_SUPERUSER_PASSWORD ??= randomBytes(24).toString('base64url')

const baseURL = 'http://localhost:8099'
const phone = { width: 390, height: 844 }

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  webServer: {
    command: 'node e2e/server.mjs',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // The default is SIGKILL, which would leave the temporary data dir behind.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    env: {
      E2E_SUPERUSER_EMAIL: process.env.E2E_SUPERUSER_EMAIL,
      E2E_SUPERUSER_PASSWORD: process.env.E2E_SUPERUSER_PASSWORD,
    },
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'de-AT',
    timezoneId: 'Europe/Vienna',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: phone } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: phone } },
    // An iPhone profile, so Ionic runs in iOS mode.
    { name: 'webkit', use: { ...devices['iPhone 14'] } },
  ],
})
