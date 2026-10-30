import {
  type APIRequestContext,
  type Browser,
  type Cookie,
  expect,
  type Page,
  test,
} from "@playwright/test";

/*
 * Organization settings and the account page, against the seeded app:
 * E2E_BASE_URL=http://localhost:3400 pnpm --filter web test:e2e e2e/settings.spec.ts
 *
 * Every change is put back: the org's name and address, and Chioma's
 * password (also in afterAll, in case a test stops halfway).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? "kola-demo-2026";
const TEMP_PASSWORD = "kola-temp-pass-2026";
const ORG_NAME = "Kola Logistics";
const SLUG = "kola-logistics";
const ADA = "ada@kolalogistics.test";
const CHIOMA = "chioma@kolalogistics.test";
const sessions: Record<string, Cookie[]> = {};

/** Better Auth allows three sign-ins per 10 seconds: wait one out. */
async function signIn(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  password = PASSWORD
) {
  for (let attempt = 0; ; attempt++) {
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email, password },
      headers: { origin: baseURL },
    });
    if (res.status() !== 429 || attempt === 3) {
      return res;
    }
    await new Promise((resolve) => setTimeout(resolve, 11_000));
  }
}

/** A fresh browser context signed in as `email`: one sign-in each, since
 *  the auth endpoint rate-limits repeated sign-ins. */
async function contextFor(browser: Browser, baseURL: string, email: string) {
  const context = await browser.newContext({ baseURL });
  const res = await signIn(context.request, baseURL, email);
  expect(res.ok()).toBe(true);
  return context;
}

test.beforeAll(async ({ browser, baseURL }) => {
  for (const email of [ADA, CHIOMA]) {
    const context = await contextFor(browser, baseURL ?? "", email);
    sessions[email] = await context.cookies();
    await context.close();
  }
});

test.afterAll(async ({ browser, baseURL }) => {
  // If the password test stopped after changing it, put it back.
  const context = await browser.newContext({ baseURL });
  const res = await signIn(
    context.request,
    baseURL ?? "",
    CHIOMA,
    TEMP_PASSWORD
  );
  if (res.ok()) {
    await context.request.post("/api/auth/change-password", {
      data: { currentPassword: TEMP_PASSWORD, newPassword: PASSWORD },
      headers: { origin: baseURL ?? "" },
    });
  }
  await context.close();
});

async function openAs(page: Page, email: string, path: string) {
  await page.context().addCookies(sessions[email] ?? []);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path, { waitUntil: "networkidle" });
}

async function saveGeneral(page: Page, name: string, slug: string) {
  const general = page.locator("#general");
  await general.getByLabel("Name").fill(name);
  await general.getByLabel("Address").fill(slug);
  const save = general.getByRole("button", { name: "Save changes" });
  await expect(save).toBeEnabled();
  await save.click();
}

test("the owner renames the organization, and it's put back", async ({
  page,
}) => {
  await openAs(page, ADA, `/app/${SLUG}/settings`);
  await saveGeneral(page, `${ORG_NAME} NG`, SLUG);
  await expect(page.getByText("Name saved")).toBeVisible();
  await expect(page.locator("[data-topbar]")).toContainText(`${ORG_NAME} NG`);

  await saveGeneral(page, ORG_NAME, SLUG);
  await expect(page.locator("[data-topbar]")).toContainText(ORG_NAME);
  await expect(page.locator("[data-topbar]")).not.toContainText("NG");
});

test("changing the address says if it's free, then moves you to it", async ({
  page,
}) => {
  await openAs(page, ADA, `/app/${SLUG}/settings`);
  const general = page.locator("#general");
  await general.getByLabel("Address").fill("account");
  await expect(general.getByText(/reserved|taken/)).toBeVisible();
  await expect(
    general.getByRole("button", { name: "Save changes" })
  ).toBeDisabled();

  await general.getByLabel("Address").fill("kola-ng");
  await expect(general.getByText("Available")).toBeVisible();
  await general.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/app\/kola-ng\/settings$/);
  await expect(page.getByLabel("Address")).toHaveValue("kola-ng");

  // The old address is gone, then restored.
  const old = await page.request.get(`/app/${SLUG}`);
  expect(old.status()).toBe(404);
  await saveGeneral(page, ORG_NAME, SLUG);
  await expect(page).toHaveURL(new RegExp(`/app/${SLUG}/settings$`));
});

test("a member sees General read-only and can only leave", async ({ page }) => {
  await openAs(page, CHIOMA, `/app/${SLUG}/settings`);
  const general = page.locator("#general");
  await expect(general.getByText("Only owners and admins")).toBeVisible();
  await expect(general.getByRole("textbox")).toHaveCount(0);
  const danger = page.locator("#danger");
  await expect(danger.getByRole("button", { name: "Leave…" })).toBeVisible();
  await expect(danger.getByText("Transfer ownership")).toHaveCount(0);
  await expect(danger.getByText("Delete organization")).toHaveCount(0);
});

test("the owner is told why delete is blocked while the plan renews", async ({
  page,
}) => {
  await openAs(page, ADA, `/app/${SLUG}/settings`);
  const blocked = page.locator("[data-delete-blocked]");
  await expect(blocked).toContainText("Cancel it in Billing first");
  await expect(
    blocked.getByRole("link", { name: /Go to Billing/ })
  ).toBeVisible();
});

test("signing out another device ends that session only", async ({
  page,
  browser,
  baseURL,
}) => {
  const phone = await contextFor(browser, baseURL ?? "", CHIOMA);
  const mine = await phone.request.get("/api/auth/get-session");
  const sessionId = (await mine.json()).session.id as string;

  await openAs(page, CHIOMA, "/app/account");
  const row = page.locator(`[data-session="${sessionId}"]`);
  if (!(await row.isVisible())) {
    await page.getByRole("button", { name: /Show \d+ more/ }).click();
  }
  await row.getByRole("button", { name: /^Sign out / }).click();
  await expect(page.getByText(/^Signed out /)).toBeVisible();
  await expect(row).toHaveCount(0);

  const after = await phone.request.get("/api/auth/get-session");
  expect(await after.json()).toBeNull();
  // This browser is still signed in.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await phone.close();
});

test("changing the password works, and the old one is restored", async ({
  page,
  browser,
  baseURL,
}) => {
  await openAs(page, CHIOMA, "/app/account#password");
  const section = page.locator("#password");
  // Keep the other demo sessions signed in.
  await section
    .getByRole("checkbox", { name: "Sign out of my other devices" })
    .uncheck();

  await section.getByLabel("Current password").fill("not-the-password");
  await section.getByLabel("New password").fill(TEMP_PASSWORD);
  await section.getByRole("button", { name: "Change password" }).click();
  await expect(section.getByRole("alert")).toContainText(
    "isn't your current password"
  );

  await section.getByLabel("Current password").fill(PASSWORD);
  await section.getByLabel("New password").fill(TEMP_PASSWORD);
  await section.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed")).toBeVisible();

  const check = await browser.newContext({ baseURL });
  expect(
    (await signIn(check.request, baseURL ?? "", CHIOMA, TEMP_PASSWORD)).ok()
  ).toBe(true);
  await check.close();

  await section
    .getByRole("checkbox", { name: "Sign out of my other devices" })
    .uncheck();
  await section.getByLabel("Current password").fill(TEMP_PASSWORD);
  await section.getByLabel("New password").fill(PASSWORD);
  await section.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed").first()).toBeVisible();
  await expect(section.getByLabel("Current password")).toHaveValue("");
});
