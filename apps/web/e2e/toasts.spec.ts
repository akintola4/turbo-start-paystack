import { expect, type Page, test } from "@playwright/test";

import { STATE, USERS } from "./users";

/*
 * Every user action should answer with a toast. These run against the e2e
 * stack (`pnpm e2e`): Ada owns Kola Logistics, Wanjiru is its viewer.
 */

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text });

// Sign-in errors are the exception: they show next to the form (5a34faa),
// where the field they're about is.
test("a wrong password says so next to the form, not in a toast", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(USERS.ada);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#auth-error")).toHaveText(
    "That email and password don't match an account."
  );
  await expect(page.getByLabel("Password")).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
});

test.describe("signed in", () => {
  test.use({ storageState: STATE.ada });

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
    await page.waitForURL(/\/checkout\/acc_/);
    await page.getByRole("button", { name: /Pay with test card/ }).click();
    await page.waitForURL(/settings\/billing/);
    // A trial start only checks the card, so it says the trial started.
    await expect(toast(page, "Trial started")).toBeVisible({
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
