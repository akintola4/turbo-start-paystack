import { existsSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";

import { type DemoUser, ORG, STATE, signIn, USERS } from "./users";

/*
 * Runs before every spec (the `setup` project in playwright.config.ts):
 *
 * 1. Signs each demo user in once and saves the session to e2e/.auth, so
 *    specs don't sign in again. A saved session that still works is reused.
 * 2. Puts Kola Logistics on a paid Pro plan with an invoice, the way a person
 *    would: "Start 14-day trial" on Pro, pay on the Paystack mock's checkout,
 *    then "End the trial" in the Simulate billing panel (the mock sends the
 *    first charge as a signed webhook). No billing row is written by hand.
 *    Skipped when the org already has a plan.
 */

setup.describe.configure({ mode: "serial" });

for (const user of Object.keys(USERS) as DemoUser[]) {
  setup(`sign in as ${user}`, async ({ browser, baseURL }) => {
    if (existsSync(STATE[user])) {
      const saved = await browser.newContext({
        baseURL,
        storageState: STATE[user],
      });
      const res = await saved.request.get("/api/auth/get-session");
      const session = res.ok() ? await res.json() : null;
      await saved.close();
      if (session?.user?.email === USERS[user]) {
        return;
      }
    }
    const context = await browser.newContext({ baseURL });
    const res = await signIn(context.request, baseURL ?? "", USERS[user]);
    expect(res.status(), `sign in as ${USERS[user]}`).toBe(200);
    await context.storageState({ path: STATE[user] });
    await context.close();
  });
}

setup("Kola Logistics is on a paid Pro plan", async ({ browser, baseURL }) => {
  setup.setTimeout(120_000);
  const context = await browser.newContext({
    baseURL,
    storageState: STATE.ada,
  });
  const page = await context.newPage();
  await page.goto(`${ORG}/settings/billing?interval=monthly`);
  const pro = page
    .locator("section[aria-labelledby=plans-title] li")
    .filter({ has: page.getByRole("heading", { name: "Pro", exact: true }) });
  await expect(pro).toBeVisible();

  const trial = pro.getByRole("button", { name: /Start 14-day trial/ });
  if (await trial.isVisible()) {
    await trial.click();
    // The mock's hosted checkout, then back to Billing.
    await page.waitForURL(/\/checkout\/acc_/);
    await page.getByRole("button", { name: /Pay with test card/ }).click();
    await page.waitForURL(/\/settings\/billing/);
    await expect(pro.getByText("Current plan")).toBeVisible({
      timeout: 30_000,
    });
  }

  const dev = page.locator("[data-dev-tools]");
  if (await page.getByText(/^Trial, \d+ days left/).isVisible()) {
    if ((await dev.getAttribute("open")) === null) {
      await dev.locator("summary").click();
    }
    await dev.getByRole("button", { name: /End the trial/ }).click();
    await expect(page.getByText(/^Trial, \d+ days left/)).toBeHidden({
      timeout: 30_000,
    });
  }
  await expect(pro.getByText("Current plan")).toBeVisible();

  // The first charge left an invoice.
  await expect(
    page
      .locator("#invoices")
      .getByText(/INV-\d{4}-\d+/)
      .first()
  ).toBeVisible();
  await context.close();
});
