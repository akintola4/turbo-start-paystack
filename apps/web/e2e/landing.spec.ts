import { expect, type Page, test } from "@playwright/test";

import { INSTALL_COMMAND, INSTALL_STEPS } from "../src/lib/landing";

/*
 * Landing page behaviour: the one currency control (the hero wall, where
 * hover only previews), the one theme control, the closing receipt and its
 * copy button, the finished-by-default webhook comparison, optical alignment
 * of the display headings, code-token contrast, and no sideways scroll at
 * any supported width. Needs only the web app running (no database).
 */

const WIDTHS = [300, 375, 768, 1024, 1440, 1920, 2560];

// The footer's status badge reads status.paystack.com from the browser.
// Answer it here, as Paystack's status API does (CORS open), so the suite
// doesn't depend on reaching Paystack.
test.beforeEach(async ({ context }) => {
  await context.route("https://status.paystack.com/**", (route) =>
    route.fulfill({
      json: { page: { status: "UP" }, activeIncidents: [] },
      headers: { "access-control-allow-origin": "*" },
    })
  );
});

async function heroPrice(page: Page) {
  return (await page.locator("[data-hero-price]").innerText()).replace(
    /\s+/g,
    " "
  );
}

const amountDue = (page: Page) => page.locator("[data-amount-due] .sr-only");
const wallTile = (page: Page, code: string) =>
  page.locator(`[data-wall-tile][data-currency=${code}]`).first();

test("copy puts the full command on the clipboard without moving anything", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const command = page.locator("[data-command]");
  const button = page.locator("[data-copy]");
  await button.scrollIntoViewIfNeeded();
  // The receipt feeds out with the scroll (GSAP, refreshed once the fonts
  // load), so measure once it has come to rest, not mid-feed.
  await page.evaluate(() => document.fonts.ready);
  let before = await button.boundingBox();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(300);
    const now = await button.boundingBox();
    if (JSON.stringify(now) === JSON.stringify(before)) {
      break;
    }
    before = now;
  }
  const commandBefore = await command.boundingBox();
  await button.click();
  await expect(button).toHaveAccessibleName("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    INSTALL_COMMAND
  );
  expect(await button.boundingBox()).toEqual(before);
  expect(await command.boundingBox()).toEqual(commandBefore);
  await expect(page.getByText("Copied the install command")).toBeVisible();
});

test("the command shows every step and is never cut off", async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const command = page.locator("[data-command]");
    const fits = await command.evaluate(
      (el) => el.scrollWidth <= el.clientWidth
    );
    expect(fits, `command overflows at ${width}px`).toBe(true);
    const lines = await command.locator(":scope > span").allInnerTexts();
    expect(lines.map((l) => l.replace(/\s+/g, " ").trim())).toEqual(
      INSTALL_STEPS.map((step) => `$ ${step}`)
    );
  }
});

test("the hero wall is the page's only currency control", async ({ page }) => {
  await page.goto("/");
  const groups = page.locator("[role=radiogroup]:has([data-currency])");
  await expect(groups).toHaveCount(1);
  await expect(groups.first()).toHaveAttribute("id", "currency");
});

test("the footer holds the page's only theme control", async ({ page }) => {
  await page.goto("/");
  const themes = page.locator("[role=radiogroup][aria-label=Theme]");
  await expect(themes).toHaveCount(1);
  await expect(
    page.locator("footer [role=radiogroup][aria-label=Theme]")
  ).toHaveCount(1);
});

test("one currency drives the hero, pricing, the receipt and the footer", async ({
  page,
}) => {
  await page.goto("/");
  await wallTile(page, "GHS").click();
  await expect.poll(() => heroPrice(page)).toContain("cedis");
  await expect(wallTile(page, "GHS")).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#pricing")).toContainText("Priced in cedis");
  await expect(amountDue(page)).toHaveText("GH₵0.00");
  await expect(page.locator(".footer-wordmark-glyph.is-on")).toHaveAttribute(
    "data-currency",
    "GHS"
  );
});

test("pointing at a tile previews it without choosing it", async ({ page }) => {
  await page.goto("/");
  const cookie = () => page.evaluate(() => document.cookie);
  const before = await cookie();

  await wallTile(page, "KES").hover();
  await expect.poll(() => heroPrice(page)).toContain("shillings");
  await expect(wallTile(page, "KES")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#pricing")).toContainText("Priced in naira");
  await expect(amountDue(page)).toHaveText("₦0.00");
  expect(await cookie()).toBe(before);

  // Leaving the wall ends the preview.
  await page.mouse.move(5, 5);
  await expect.poll(() => heroPrice(page)).toContain("naira");

  // A click commits, and only then is it remembered.
  await wallTile(page, "KES").click();
  await expect(page.locator("#pricing")).toContainText("Priced in shillings");
  expect(await cookie()).toContain("tsp-currency=KES");
});

test("arrow keys on the wall move and choose", async ({ page }) => {
  await page.goto("/");
  await wallTile(page, "NGN").focus();
  await page.keyboard.press("ArrowRight");
  await expect(wallTile(page, "GHS")).toBeFocused();
  await expect(wallTile(page, "GHS")).toHaveAttribute("aria-checked", "true");
  await expect(amountDue(page)).toHaveText("GH₵0.00");
});

// The webhooks proof is hidden: landing.tsx keeps it commented out, with a
// note to restore it along with the "How billing works" nav item. Un-skip
// these two when it comes back.
test.skip("the webhook comparison opens on its outcome", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("[data-verdict=browser]").first()).toBeVisible();
  await expect(page.locator("[data-verdict=signed]").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replay the requests" })
  ).toBeVisible();
});

test.skip("on phones each request shows both answers", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const compact = page.locator("[data-webhooks-compact]");
  await expect(compact).toBeVisible();
  const rows = compact.locator("ol > li");
  await expect(rows).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(rows.nth(i)).toContainText("Browser");
    await expect(rows.nth(i)).toContainText("Signed");
  }
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
    for (const width of WIDTHS) {
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

test("the landing does not shift as it loads", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) {
          (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.waitForTimeout(2500);
  const cls = await page.evaluate(
    () => (window as unknown as { __cls: number }).__cls
  );
  expect(cls).toBeLessThan(0.01);
  await context.close();
});

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

test("theme and currency are remembered", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer [data-segment=dark]").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await wallTile(page, "ZAR").click();
  await expect(amountDue(page)).toHaveText("R0.00");

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(wallTile(page, "ZAR")).toHaveAttribute("aria-checked", "true");
  await expect(amountDue(page)).toHaveText("R0.00");
});

test("the wordmark runs edge to edge and its tile holds every symbol", async ({
  page,
}) => {
  for (const width of [300, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const code of ["NGN", "GHS", "ZAR", "KES", "USD"]) {
      await wallTile(page, code).click();
      // At the very bottom the wordmark has finished rising.
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      );
      await page.waitForTimeout(500); // the symbol's slide-in settles
      const fit = await page.evaluate(() => {
        const wrap = document.querySelector("[data-wordmark]") as HTMLElement;
        const tile = wrap.querySelector(".footer-wordmark-tile") as HTMLElement;
        const glyph = tile.querySelector(".is-on > span") as HTMLElement;
        const w = wrap.getBoundingClientRect();
        const t = tile.getBoundingClientRect();
        const g = glyph.getBoundingClientRect();
        return {
          reachesEdge: Math.abs(t.right - w.right) <= 1,
          inside:
            g.left >= t.left &&
            g.right <= t.right &&
            g.top >= t.top &&
            g.bottom <= t.bottom,
        };
      });
      expect(fit, `${code} at ${width}px`).toEqual({
        reachesEdge: true,
        inside: true,
      });
    }
  }
});

test("every control on the landing has press feedback", async ({ page }) => {
  await page.goto("/");
  const missing = await page.evaluate(() => {
    const controls = document.querySelectorAll<HTMLElement>(
      'button, a[role=button], [data-slot=button], [role=radio], [role=tab], a[class*="bg-"], footer a'
    );
    return [...controls]
      .filter((el) => !el.closest("[data-sonner-toaster], nextjs-portal"))
      .filter((el) => ![...el.classList].some((c) => c.startsWith("pressable")))
      .map(
        (el) => `${el.tagName} "${(el.textContent ?? "").trim().slice(0, 30)}"`
      );
  });
  expect(missing).toEqual([]);
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

/**
 * First column of ink in a screenshot clip, scanning right from `pad` px left
 * of `edge`: the first column whose colour differs clearly from the clip's
 * left edge (the background).
 */
async function inkLeft(
  page: Page,
  edge: number,
  top: number,
  height: number
): Promise<number> {
  const pad = 12;
  const png = await page.screenshot({
    clip: { x: edge - pad, y: top, width: pad + 48, height },
  });
  const x = await page.evaluate(
    async ({ b64 }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d") as CanvasRenderingContext2D;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      const at = (px: number, py: number): [number, number, number] => {
        const i = (py * img.width + px) * 4;
        return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
      };
      const bg = at(0, Math.floor(img.height / 2));
      for (let px = 0; px < img.width; px++) {
        for (let py = 0; py < img.height; py++) {
          const p = at(px, py);
          const d =
            Math.abs(p[0] - bg[0]) +
            Math.abs(p[1] - bg[1]) +
            Math.abs(p[2] - bg[2]);
          if (d > 200) {
            return px;
          }
        }
      }
      return -1;
    },
    { b64: png.toString("base64") }
  );
  return edge - pad + x;
}

test("display headings put their first letter's ink on the content edge", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const targets = page.locator(
    "h1[data-hero-title] > span:first-child, main h2.display-l"
  );
  const count = await targets.count();
  // The hero and three section headings (the webhooks proof is hidden).
  expect(count).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < count; i++) {
    const t = targets.nth(i);
    await t.scrollIntoViewIfNeeded();
    const m = await t.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        edge: r.left - Number.parseFloat(style.marginLeft),
        top: r.top,
        line: Number.parseFloat(style.lineHeight) || r.height,
        text: (el.textContent ?? "").slice(0, 20),
      };
    });
    const ink = await inkLeft(page, m.edge, m.top, Math.round(m.line * 0.8));
    expect(
      Math.abs(ink - m.edge),
      `"${m.text}" ink at ${ink}, edge at ${m.edge}`
    ).toBeLessThanOrEqual(1.5);
  }
  await context.close();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`code tokens pass AA on the code surface, ${colorScheme}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    await page.goto("/");
    const worst = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d", {
        willReadFrequently: true,
      }) as CanvasRenderingContext2D;
      const rgb = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const lum = (c: number[]) => {
        const [r, g, b] = c.map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
      };
      // Each token against the surface it is painted on (its nearest
      // ancestor with a background): the features editor's code pane, or
      // the preview card beside it.
      const surface = (el: Element) => {
        let node: Element | null = el;
        while (node) {
          const color = getComputedStyle(node).backgroundColor;
          if (!/^(transparent|rgba\(.*,\s*0\))$/.test(color)) {
            return color;
          }
          node = node.parentElement;
        }
        return "white";
      };
      const spans = document.querySelectorAll<HTMLElement>(
        "[data-token], code > span:not([aria-hidden])"
      );
      if (spans.length === 0) {
        throw new Error("no code tokens on the page");
      }
      let min = Number.POSITIVE_INFINITY;
      for (const span of spans) {
        const bg = lum(rgb(surface(span)));
        const fg = lum(rgb(getComputedStyle(span).color));
        const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        min = Math.min(min, ratio);
      }
      return min;
    });
    expect(worst).toBeGreaterThanOrEqual(4.5);
    await context.close();
  });
}

test("the active feature tab shows all four indicator edges", async ({
  browser,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [375, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto("/");
      const tabs = page.locator("[role=tab]");
      const count = await tabs.count();
      for (let i = 0; i < count; i++) {
        const tab = tabs.nth(i);
        await tab.click();
        await page.waitForTimeout(250);
        const box = await tab.boundingBox();
        if (!box) {
          throw new Error(`tab ${i} has no box`);
        }
        const pad = 4;
        const png = await page.screenshot({
          clip: {
            x: box.x - pad,
            y: box.y - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
          },
        });
        const edges = await page.evaluate(
          async ({ b64, w, h, pad }) => {
            const img = new Image();
            img.src = `data:image/png;base64,${b64}`;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d") as CanvasRenderingContext2D;
            ctx.drawImage(img, 0, 0);
            const px = (x: number, y: number) =>
              ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
            const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
              Math.abs((a[0] ?? 0) - (b[0] ?? 0)) +
              Math.abs((a[1] ?? 0) - (b[1] ?? 0)) +
              Math.abs((a[2] ?? 0) - (b[2] ?? 0));
            // Strongest contrast in a 3px band across each edge midpoint,
            // against the background 3px outside the tab.
            const band = (pts: [number, number][], out: [number, number]) =>
              Math.max(...pts.map(([x, y]) => diff(px(x, y), px(...out))));
            const cx = pad + w / 2;
            const cy = pad + h / 2;
            return {
              top: band(
                [
                  [cx, pad - 1],
                  [cx, pad],
                  [cx, pad + 1],
                ],
                [cx, 1]
              ),
              bottom: band(
                [
                  [cx, pad + h - 2],
                  [cx, pad + h - 1],
                  [cx, pad + h],
                ],
                [cx, pad * 2 + h - 2]
              ),
              left: band(
                [
                  [pad - 1, cy],
                  [pad, cy],
                  [pad + 1, cy],
                ],
                [1, cy]
              ),
              right: band(
                [
                  [pad + w - 2, cy],
                  [pad + w - 1, cy],
                  [pad + w, cy],
                ],
                [pad * 2 + w - 2, cy]
              ),
            };
          },
          { b64: png.toString("base64"), w: box.width, h: box.height, pad }
        );
        for (const [edge, delta] of Object.entries(edges)) {
          expect(
            delta,
            `${colorScheme} ${width}px tab ${i} ${edge} edge`
          ).toBeGreaterThanOrEqual(6);
        }
      }
      await context.close();
    }
  }
});

test("feature tab filenames share one baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const bottoms = await page
    .locator("[data-tab-file]")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().bottom));
  expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(0.5);
});
