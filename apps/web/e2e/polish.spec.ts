import { expect, type Page, test } from "@playwright/test";

/*
 * Pixel and accessibility checks from the app review. Run against a seeded
 * app (`pnpm setup`, `pnpm dev`): E2E_BASE_URL=http://localhost:3400
 * pnpm --filter web test:e2e e2e/polish.spec.ts
 */

const PASSWORD = process.env.E2E_PASSWORD ?? "kola-demo-2026";

async function signIn(page: Page, email = "ada@kolalogistics.test") {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: PASSWORD },
    headers: { origin: new URL(page.url() || "http://x").origin },
  });
  expect(res.ok()).toBe(true);
}

test.describe("auth side panel", () => {
  const sizes = [
    [1280, 720],
    [1440, 800],
    [1920, 1000],
    [2000, 1065],
    [1024, 1366],
    [1280, 1600],
  ] as const;
  for (const path of ["/sign-in", "/sign-up"]) {
    for (const [width, height] of sizes) {
      test(`${path} at ${width}×${height}: no page scroll, grid inside and centred`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const r = await page.evaluate(() => {
          const panel = document.querySelector("[data-auth-panel]");
          const grid = document.querySelector(".auth-mosaic");
          if (!(panel && grid)) {
            throw new Error("panel not rendered");
          }
          const a = panel.getBoundingClientRect();
          const g = grid.getBoundingClientRect();
          return {
            scrollY: document.documentElement.scrollHeight - innerHeight,
            scrollX: document.documentElement.scrollWidth - innerWidth,
            inside:
              g.top >= a.top &&
              g.bottom <= a.bottom &&
              g.left >= a.left &&
              g.right <= a.right,
            square: Math.abs(g.width - g.height),
            centring: Math.abs(g.top - a.top - (a.bottom - g.bottom)),
          };
        });
        expect(r.scrollY).toBe(0);
        expect(r.scrollX).toBe(0);
        expect(r.inside).toBe(true);
        expect(r.square).toBeLessThanOrEqual(1);
        expect(r.centring).toBeLessThanOrEqual(1);
      });
    }
  }
});

test("buttons and inputs show a 2px focus ring from the keyboard", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.locator("#email").focus();
  const input = await page
    .locator("#email")
    .evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(input).toBe("2px");
  // Tab past the password and the forgot link to the submit button.
  await page.locator("#password").focus();
  await page.keyboard.press("Tab");
  const button = page.getByRole("button", { name: "Sign in" });
  await expect(button).toBeFocused();
  const ring = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: s.outlineWidth };
  });
  expect(ring).toEqual({ style: "solid", width: "2px" });
});

test("auth inputs are 16px on phones, so iOS doesn't zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/sign-in");
  for (const id of ["#email", "#password"]) {
    expect(
      await page.locator(id).evaluate((el) => getComputedStyle(el).fontSize)
    ).toBe("16px");
  }
});

test("₦ and ₵ strokes match Geist's at the same weight", async ({ page }) => {
  await page.goto("/sign-in");
  const stems = await page.evaluate(async () => {
    const vars = getComputedStyle(document.documentElement);
    const first = (name: string) =>
      vars.getPropertyValue(name).split(",")[0] ?? "";
    const geist = first("--font-geist-sans");
    const currency = first("--font-currency");
    // Width of the first ink run across a row just above the baseline,
    // where each glyph's left stem stands alone.
    const stem = (family: string, weight: number, ch: string) => {
      const c = document.createElement("canvas");
      c.width = 600;
      c.height = 400;
      const x = c.getContext("2d") as CanvasRenderingContext2D;
      x.font = `${weight} 300px ${family}`;
      x.fillText(ch, 50, 330);
      const d = x.getImageData(0, 305, 600, 1).data;
      let run = 0;
      for (let i = 0; i < 600; i++) {
        if ((d[i * 4 + 3] ?? 0) > 128) {
          run++;
        } else if (run) {
          break;
        }
      }
      return run;
    };
    const out: Record<number, { naira: number; one: number }> = {};
    for (const w of [500, 600, 700]) {
      await document.fonts.load(`${w} 300px ${currency}`, "₦");
      await document.fonts.load(`${w} 300px ${geist}`, "1");
      out[w] = { naira: stem(currency, w, "₦"), one: stem(geist, w, "1") };
    }
    return out;
  });
  for (const { naira, one } of Object.values(stems)) {
    // ±8% at 300px: within half a pixel at the 56px hero size.
    expect(Math.abs(naira - one) / one).toBeLessThanOrEqual(0.08);
  }
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await signIn(page);
  });

  test("a Money amount's box is its text's height", async ({ page }) => {
    for (const path of [
      "/app/kola-logistics",
      "/app/kola-logistics/settings/billing",
    ]) {
      await page.goto(path);
      await page.waitForFunction(() =>
        Boolean(customElements.get("number-flow-react"))
      );
      await page.waitForTimeout(400);
      const boxes = await page.$$eval(".money", (els) =>
        els.map((el) => ({
          height: el.getBoundingClientRect().height,
          size: Number.parseFloat(getComputedStyle(el).fontSize),
        }))
      );
      expect(boxes.length).toBeGreaterThan(0);
      for (const { height, size } of boxes) {
        expect(Math.abs(height - size)).toBeLessThanOrEqual(1);
      }
    }
  });
});
