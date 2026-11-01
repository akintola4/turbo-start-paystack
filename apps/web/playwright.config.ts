import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks against a running app (default http://localhost:3200)
 * with the Paystack mock wired to it. Not part of `pnpm test`: `pnpm e2e`
 * at the repo root resets an e2e database, starts the mock and the app, and
 * runs this suite (see the README's Tests section). The `setup` project signs
 * the demo users in and puts the demo org on a paid plan first.
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
  projects: [
    { name: "setup", testMatch: /\.setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /settings\.spec\.ts$/,
    },
    // Renames the demo org and moves its address (then puts both back), so
    // it runs alone, after everything else, even with --workers > 1.
    {
      name: "settings",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["chromium"],
      testMatch: /settings\.spec\.ts$/,
    },
  ],
});
