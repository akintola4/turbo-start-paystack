import { expect, type Page, test } from "@playwright/test";

/*
 * Sign-in and sign-up are for visitors. A signed-in user who opens them is
 * redirected on the server to their safe callbackURL, or the dashboard.
 * Needs the database (it signs in as the demo owner). It signs in once:
 * Better Auth rate-limits sign-in.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? "kola-demo-2026";
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

test("signed in, the auth pages send you into the app", async ({
  page,
  baseURL,
}) => {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "ada@kolalogistics.test", password: PASSWORD },
    headers: { origin: baseURL ?? "" },
  });
  expect(res.ok()).toBe(true);

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
