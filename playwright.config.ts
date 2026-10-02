import { defineConfig } from '@playwright/test';

// Runs against `next dev` on port 3200 with the local database and sample sign-in.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:3200', screenshot: 'only-on-failure', launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {} },
  webServer: {
    command: 'npx next dev -p 3200',
    url: 'http://localhost:3200/signin',
    reuseExistingServer: true,
    timeout: 180_000,
    env: { DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci', DEV_LOGIN: 'true', AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret', AUTH_TRUST_HOST: 'true' },
  },
});
