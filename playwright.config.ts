import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the storefront E2E suite.
 *
 * Prerequisites (run once before `npm run test:e2e`):
 *   npm run e2e:up      # boots Docker + bootstraps Spree via @spree/cli
 *
 * That seeds Spree with sample data and writes `.env.e2e` with the
 * publishable key the storefront needs.
 *
 * The `webServer` block boots `next dev` against `.env.e2e` and waits for it
 * to respond before running tests.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "./scripts/e2e/dev-with-env.sh",
    url: "http://localhost:3001/us/en",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
