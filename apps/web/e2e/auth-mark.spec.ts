import { expect, test } from "@playwright/test";

/*
 * The auth panel's "Your mark". Run against the app:
 * E2E_BASE_URL=http://localhost:3400 pnpm --filter web test:e2e e2e/auth-mark.spec.ts
 */

const EMAIL = "amara@lagosbakery.test";

for (const path of ["/sign-in", "/sign-up"]) {
  test(`${path}: typing the email draws one mirrored mark with one sunflower`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto(path);
    const panel = page.locator("[data-auth-panel]");
    const sun = panel.locator('[data-colour="sun"]');
    await expect(panel.locator('[data-colour="seed"]')).toHaveCount(25);

    await page.locator("#email").pressSequentially("amar", { delay: 20 });
    await expect(sun).toHaveCount(0);
    await page.locator("#email").pressSequentially("a@lagosbakery.test");
    await expect(panel.locator('[data-colour="seed"]')).toHaveCount(0);
    await expect(sun).toHaveCount(1);

    // Same email, same mark after a reload.
    const first = await panel
      .locator("[data-shape]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-key")));
    await page.reload();
    await page.locator("#email").fill(EMAIL);
    await expect(sun).toHaveCount(1);
    const again = await panel
      .locator("[data-shape]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-key")));
    expect(again).toEqual(first);
  });
}

test("the panel is hidden from assistive tech and holds nothing focusable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/sign-in");
  const panel = page.locator("[data-auth-panel]");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(
    panel.locator("a, button, input, select, textarea, [tabindex]")
  ).toHaveCount(0);
});

test("a wrong password turns the sunflower cell red", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      }),
    })
  );
  await page.goto("/sign-in");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const mark = page.locator(".auth-mosaic");
  await expect(mark).toHaveAttribute("data-error", "");
  await page.locator("#password").fill("another-try-123");
  await expect(mark).not.toHaveAttribute("data-error", "");
});

test("reduced motion draws the mark without animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/sign-in");
  await page.locator("#email").fill(EMAIL);
  const running = await page
    .locator("[data-auth-panel]")
    .evaluate(
      (panel) =>
        panel
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === "running").length
    );
  expect(running).toBe(0);
  await expect(
    page.locator('[data-auth-panel] [data-colour="sun"]')
  ).toHaveCount(1);
});

test("phones get a slim band with an 80px mark, and no sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/sign-up");
  const band = await page.locator("[data-auth-panel]").boundingBox();
  const mark = await page.locator(".auth-mosaic").boundingBox();
  expect(band?.height).toBe(112);
  expect(mark?.width).toBe(80);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
  ).toBe(0);
});

test("an unknown email and a wrong password fail the same way", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  const email = "ada@kolalogistics.test";
  const attempt = async (password: string, as = email) => {
    await page.goto("/sign-in");
    await page.locator("#email").fill(as);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    const mark = page.locator(".auth-mosaic");
    await expect(mark).toHaveAttribute("data-error", "");
    const shakes = await mark.evaluate((el) => el.getAnimations().length);
    await page.waitForTimeout(800);
    return {
      shakes,
      caption: await page.locator(".auth-panel__line").innerText(),
      alert: await page.locator("#auth-error").innerText(),
    };
  };
  const wrongPassword = await attempt("not-the-password-123");
  const unknownEmail = await attempt(
    "not-the-password-123",
    "nobody@kolalogistics.test"
  );
  expect(unknownEmail.caption).toBe(wrongPassword.caption);
  expect(unknownEmail.shakes).toBe(wrongPassword.shakes);
  expect(unknownEmail.alert).toBe(wrongPassword.alert);
  expect(wrongPassword.caption).toBe("Check your details and try again.");
});
