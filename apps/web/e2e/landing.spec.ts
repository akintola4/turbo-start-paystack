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

test("the landing logs no console errors or warnings", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      problems.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto("/"); // first visit: the intro plays
  await page.waitForTimeout(1500);
  await page.reload(); // same session: no intro
  await page.waitForTimeout(800);
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await page.waitForURL("**/sign-in");
  await page.goBack(); // client navigation back to "/"
  await page.waitForTimeout(800);

  expect(problems).toEqual([]);
});

test("footer and receipt controls stay in sync and are remembered", async ({
  page,
}) => {
  await page.goto("/");
  const receipt = page.locator("section[aria-labelledby=receipt-title]");
  await page.locator("footer [data-segment=dark]").click();
  await expect(receipt.getByRole("radio", { name: "Dark" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await page.locator("footer [role=radio][data-currency=ZAR]").click();
  await expect(page.locator("[data-amount-due] .sr-only")).toHaveText("R0.00");
  await receipt.locator("[role=radio][data-currency=GHS]").click();
  await expect(
    page.locator("footer [role=radio][data-currency=GHS]")
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".footer-wordmark-glyph.is-on")).toHaveAttribute(
    "data-currency",
    "GHS"
  );

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.locator("#pricing [role=radio][data-currency=GHS]")
  ).toHaveAttribute("aria-checked", "true");
});

test("the wordmark tile holds every symbol at every width", async ({
  page,
}) => {
  for (const width of [300, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    // At the very bottom the wordmark has finished rising.
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    for (const code of ["NGN", "GHS", "ZAR", "KES", "USD"]) {
      await page.locator(`footer [role=radio][data-currency=${code}]`).click();
      await page.waitForTimeout(500); // the symbol's slide-in settles
      const fit = await page.evaluate(() => {
        const wrap = document.querySelector("[data-wordmark]") as HTMLElement;
        const tile = wrap.querySelector(".footer-wordmark-tile") as HTMLElement;
        const glyph = tile.querySelector(".is-on > span") as HTMLElement;
        const w = wrap.getBoundingClientRect();
        const t = tile.getBoundingClientRect();
        const g = glyph.getBoundingClientRect();
        return (
          t.right <= w.right &&
          g.left >= t.left &&
          g.right <= t.right &&
          g.top >= t.top &&
          g.bottom <= t.bottom
        );
      });
      expect(fit, `${code} at ${width}px`).toBe(true);
    }
  }
});

test("every control on the landing has press feedback", async ({ page }) => {
  for (const q of ["", "?features=b", "?features=c"]) {
    await page.goto(`/${q}`);
    const missing = await page.evaluate(() => {
      const controls = document.querySelectorAll<HTMLElement>(
        'button, a[role=button], [data-slot=button], [role=radio], [role=tab], a[class*="bg-"]'
      );
      return [...controls]
        .filter((el) => !el.closest("[data-sonner-toaster], nextjs-portal"))
        .filter(
          (el) => ![...el.classList].some((c) => c.startsWith("pressable"))
        )
        .map(
          (el) =>
            `${el.tagName} "${(el.textContent ?? "").trim().slice(0, 30)}"`
        );
    });
    expect(missing, `controls without press feedback on /${q}`).toEqual([]);
  }
});

test("the copy button's label is centred in both states", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const button = page.locator("[data-copy]");
  await button.scrollIntoViewIfNeeded();
  const probe = (label: string) =>
    button.evaluate((btn, text) => {
      const group = btn.querySelector(
        `[data-copy-label="${text}"]`
      ) as HTMLElement;
      const b = btn.getBoundingClientRect();
      const g = group.getBoundingClientRect();
      const icon = group.querySelector("svg")?.getBoundingClientRect();
      const word = group.querySelector("span")?.getBoundingClientRect();
      return {
        padDiff: Math.abs(g.left - b.left - (b.right - g.right)),
        iconOffset:
          icon && word
            ? Math.abs(
                (icon.top + icon.bottom) / 2 - (word.top + word.bottom) / 2
              )
            : 0,
      };
    }, label);
  const copy = await probe("Copy");
  expect(copy.padDiff).toBeLessThanOrEqual(1);
  expect(copy.iconOffset).toBeLessThanOrEqual(0.5);
  await button.click();
  await page.waitForTimeout(300);
  const copied = await probe("Copied");
  expect(copied.padDiff).toBeLessThanOrEqual(1);
  expect(copied.iconOffset).toBeLessThanOrEqual(0.5);
});
