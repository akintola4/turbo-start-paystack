import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks against a running app (default http://localhost:3200)
 * with the Paystack mock wired to it. Not part of `pnpm test`: run
 * `pnpm --filter web test:e2e` once the app, Postgres and the mock are up.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
