import { expect, type Page, test } from "@playwright/test";

/*
 * Every user action should answer with a toast. These run against the seeded
 * demo data (see README): ada@kolalogistics.test owns Kola Logistics.
 */

const OWNER = {
  email: process.env.E2E_EMAIL ?? "ada@kolalogistics.test",
  password: process.env.E2E_PASSWORD ?? "demo-password-2026",
};

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text });

async function signIn(page: Page) {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: OWNER,
    headers: {
      origin: new URL(
        page.url() === "about:blank" ? "http://localhost:3200" : page.url()
      ).origin,
      // Better Auth rate-limits by IP; give each run its own.
      "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
  });
  expect(res.ok()).toBeTruthy();
}

test("a wrong password says so in a toast", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(OWNER.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(toast(page, "Couldn't sign in")).toBeVisible();
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await signIn(page);
  });

  test("create an org, invite someone, and start a paid plan through Paystack", async ({
    page,
  }) => {
    const name = `E2E ${Date.now().toString(36)}`;
    await page.goto("/app#new");
    await page.getByLabel("Organization name").fill(name);
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(toast(page, `${name} is ready`)).toBeVisible();
    await page.waitForURL(/\/app\/e2e-/);
    const base = new URL(page.url()).pathname;

    await page.goto(`${base}/members`);
    const invitee = `invitee-${Date.now().toString(36)}@example.test`;
    await page.getByLabel("Email address").fill(invitee);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(toast(page, `Invitation sent to ${invitee}`)).toBeVisible();

    await page.goto(`${base}/settings/billing`);
    await page
      .getByRole("button", { name: /Start 14-day trial/ })
      .first()
      .click();
    // The local Paystack mock's hosted checkout page.
    await page.waitForURL(/localhost:4011\/checkout\//);
    await page.getByRole("button", { name: /Pay with test card/ }).click();
    await page.waitForURL(/settings\/billing/);
    await expect(toast(page, "Payment confirmed")).toBeVisible({
      timeout: 25_000,
    });
  });

  test("changing a role confirms in a toast", async ({ page }) => {
    await page.goto("/app/kola-logistics/members");
    const select = page.getByRole("combobox", {
      name: "Role for Wanjiru Kamau",
    });
    const before =
      (await select.locator("[data-slot=select-value]").innerText()).trim() ||
      "Viewer";
    const next = before === "Viewer" ? "Member" : "Viewer";
    await select.click();
    await page.getByRole("option", { name: next }).click();
    await expect(toast(page, /Wanjiru Kamau is now/)).toBeVisible();
    // Start from a fresh render before putting the role back.
    await page.reload({ waitUntil: "networkidle" });
    await expect(select.locator("[data-slot=select-value]")).toHaveText(next);
    // Put it back so the demo data stays as seeded.
    await select.click();
    await page.getByRole("option", { name: before }).click();
    await expect(
      toast(page, new RegExp(`now an? ${before.toLowerCase()}`))
    ).toBeVisible();
  });
});
