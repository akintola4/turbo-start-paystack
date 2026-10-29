import { expect, type Page, test } from "@playwright/test";

/*
 * Layout checks for animated amounts (NumberFlow). Each amount is one
 * element: symbol, digits and unit share a baseline, the unit sits the same
 * distance from the digits on every tile, and the element's box is the
 * text's own height.
 */

type Probe = {
  symbol: number;
  digits: number;
  unit: number | null;
  gap: number | null;
  ratio: number;
};

async function probeAmounts(page: Page, scope: string): Promise<Probe[]> {
  await page.waitForTimeout(400);
  return page.$$eval(`${scope} .money number-flow-react`, (els) =>
    els.map((el) => {
      const root = (el as HTMLElement).shadowRoot as ShadowRoot;
      const marker = (part: Element | null) => {
        if (!part) {
          return null;
        }
        const m = document.createElement("span");
        m.style.cssText = "display:inline-block;width:0;height:0";
        part.appendChild(m);
        const top = m.getBoundingClientRect().top;
        m.remove();
        return top;
      };
      const prefix = root.querySelector('[part~="prefix"]');
      const digits = [...root.querySelectorAll('[part~="digit"]')];
      const suffix = root.querySelector('[part~="suffix"]');
      const lastDigit = digits.at(-1) ?? null;
      const size = Number.parseFloat(getComputedStyle(el).fontSize);
      return {
        symbol: marker(prefix) ?? 0,
        digits: marker(digits[0] ?? null) ?? 0,
        unit: marker(suffix),
        gap:
          suffix && lastDigit
            ? suffix.getBoundingClientRect().left -
              lastDigit.getBoundingClientRect().right
            : null,
        // Layout height: the mask padding is cancelled by negative margins.
        ratio:
          (el.getBoundingClientRect().height +
            Number.parseFloat(getComputedStyle(el).marginTop) +
            Number.parseFloat(getComputedStyle(el).marginBottom)) /
          size,
      };
    })
  );
}

function expectAligned(probes: Probe[]) {
  expect(probes.length).toBeGreaterThan(0);
  for (const p of probes) {
    expect(Math.abs(p.symbol - p.digits)).toBeLessThanOrEqual(0.5);
    if (p.unit !== null) {
      expect(Math.abs(p.unit - p.digits)).toBeLessThanOrEqual(0.5);
    }
    expect(p.ratio).toBeLessThanOrEqual(1.25);
  }
}

function expectEvenGaps(probes: Probe[]) {
  const gaps = probes.map((p) => p.gap).filter((g): g is number => g !== null);
  expect(gaps.length).toBeGreaterThan(1);
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
}

async function signIn(page: Page) {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "ada@kolalogistics.test", password: "demo-password-2026" },
    headers: {
      origin: "http://localhost:3200",
      "x-forwarded-for": `10.78.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
  });
  expect(res.ok()).toBeTruthy();
}

test("landing preview and plan tiles share a baseline and even gaps", async ({
  page,
}) => {
  await page.goto("/");
  expectAligned(await probeAmounts(page, "aside[aria-label=Currencies]"));
  const tiles = await probeAmounts(
    page,
    "section[aria-labelledby=pricing-title]"
  );
  expectAligned(tiles);
  expectEvenGaps(tiles);
});

test.describe("billing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await signIn(page);
  });

  test("hero and plan tiles, monthly and annually", async ({ page }) => {
    await page.goto("/app/kola-logistics/settings/billing?interval=monthly");
    expectAligned(await probeAmounts(page, "[data-surface=panel]"));
    const monthly = await probeAmounts(
      page,
      "section[aria-labelledby=plans-title]"
    );
    expectAligned(monthly);
    expectEvenGaps(monthly);
    await page.getByRole("radio", { name: "Annually" }).click();
    // Let the 850ms roll finish before measuring.
    await page.waitForTimeout(1200);
    const annual = await probeAmounts(
      page,
      "section[aria-labelledby=plans-title]"
    );
    expectAligned(annual);
    expectEvenGaps(annual);
  });

  test("the org list renders each number once", async ({ page }) => {
    await page.goto("/app");
    const empty = await page.$$eval(
      "number-flow-react",
      (els) =>
        els.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width === 0 || r.height === 0;
        }).length
    );
    expect(empty).toBe(0);
  });

  test("an amount's accessible name is just the value", async ({ page }) => {
    await page.goto("/app/kola-logistics/settings/billing?interval=monthly");
    const snapshot = await page
      .locator("[data-surface=panel]")
      .first()
      .ariaSnapshot();
    expect(snapshot).toContain("30,000 naira per month");
    expect(snapshot).not.toMatch(/:host|@keyframes|--number-flow/);
  });
});
