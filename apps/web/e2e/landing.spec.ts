import { expect, type Page, test } from "@playwright/test";

/*
 * Landing page behaviour: the copy button, one currency across hero, pricing
 * and footer, the receipt respecting reduced motion, and no sideways scroll
 * at any supported width. Needs only the web app running (no database).
 */

const COMMAND = "npx degit akintola4/turbo-start-paystack my-saas";

async function heroPrice(page: Page) {
  return (await page.locator("[data-hero-price]").innerText()).replace(
    /\s+/g,
    " "
  );
}

test("copy puts the full command on the clipboard without moving anything", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const bar = page.locator("[data-command]").locator("..");
  const button = page.locator("[data-copy]");
  await button.scrollIntoViewIfNeeded();
  const before = await button.boundingBox();
  const barBefore = await bar.boundingBox();
  await button.click();
  await expect(button).toHaveAccessibleName("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    COMMAND
  );
  expect(await button.boundingBox()).toEqual(before);
  expect(await bar.boundingBox()).toEqual(barBefore);
  await expect(page.getByText("Copied the install command")).toBeVisible();
});

test("the command is never cut off", async ({ page }) => {
  for (const width of [300, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const fits = await page
      .locator("[data-command]")
      .evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits, `command overflows at ${width}px`).toBe(true);
    await expect(page.locator("[data-command]")).toHaveText(`$ ${COMMAND}`);
  }
});

test("one currency drives the hero, pricing and the footer", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#pricing [role=radio][data-currency=GHS]").click();
  await expect.poll(() => heroPrice(page)).toContain("cedis");
  await expect(
    page.locator("[data-wall-tile][data-currency=GHS]").first()
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-amount-due] .sr-only")).toHaveText(
    "GH₵0.00"
  );

  await page.locator("footer [role=radio][data-currency=KES]").click();
  await expect(
    page.locator("#pricing [role=radio][data-currency=KES]")
  ).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => heroPrice(page)).toContain("shillings");

  await page.locator("[data-wall-tile][data-currency=USD]").first().click();
  await expect(
    page.locator("#pricing [role=radio][data-currency=USD]")
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("[data-amount-due] .sr-only")).toHaveText("$0.00");
});

/** The paper's vertical offset when the feeder's top is at 70% of the viewport. */
async function paperOffsetMidway(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    const feeder = document.querySelector("[data-receipt-feeder]");
    const top = (feeder?.getBoundingClientRect().top ?? 0) + window.scrollY;
    window.scrollTo(0, top - window.innerHeight * 0.7);
  });
  await page.waitForTimeout(400);
  return page
    .locator("[data-receipt-paper]")
    .evaluate(
      (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42
    );
}

test("the receipt prints with the scroll", async ({ page }) => {
  expect(await paperOffsetMidway(page)).toBeLessThan(-20);
});

test("the receipt is already printed under reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  expect(await paperOffsetMidway(page)).toBe(0);
  await context.close();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`no sideways scroll, ${colorScheme}`, async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    for (const width of [300, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow, `${width}px overflows by ${overflow}px`).toBe(0);
    }
    await context.close();
  });
}
