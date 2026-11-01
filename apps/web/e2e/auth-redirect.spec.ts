import { expect, type Page, test } from "@playwright/test";

import { STATE } from "./users";

/*
 * Sign-in and sign-up are for visitors. A signed-in user who opens them is
 * redirected on the server to their safe callbackURL, or the dashboard.
 * Needs the database (it uses the demo owner's saved session).
 */

const IN_APP = /^\/app(\/|$)/;

function pathOf(page: Page) {
  return new URL(page.url()).pathname;
}

for (const path of ["/sign-in", "/sign-up"]) {
  test(`signed out, ${path} shows the form`, async ({ page }) => {
    await page.goto(path);
    expect(pathOf(page)).toBe(path);
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });
}

test.describe("signed in", () => {
  test.use({ storageState: STATE.ada });

  test("the auth pages send you into the app", async ({ page, baseURL }) => {
    await test.step("/sign-in lands in the app", async () => {
      await page.goto("/sign-in");
      expect(pathOf(page)).toMatch(IN_APP);
    });

    await test.step("/sign-in follows a safe callbackURL", async () => {
      await page.goto("/sign-in?callbackURL=/app/kola-logistics/members");
      expect(pathOf(page)).toBe("/app/kola-logistics/members");
    });

    for (const evil of ["https://evil.example", "//evil.example"]) {
      await test.step(`/sign-in ignores callbackURL=${evil}`, async () => {
        await page.goto(`/sign-in?callbackURL=${encodeURIComponent(evil)}`);
        const url = new URL(page.url());
        expect(url.origin).toBe(new URL(baseURL ?? "").origin);
        expect(url.pathname).toMatch(IN_APP);
      });
    }

    await test.step("/sign-up lands in the app", async () => {
      await page.goto("/sign-up");
      expect(pathOf(page)).toMatch(IN_APP);
    });
  });
});
