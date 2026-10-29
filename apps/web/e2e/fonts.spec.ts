import { type Browser, expect, test } from "@playwright/test";

/*
 * Geist swaps in over a metric-matched fallback ("Geist Fallback" and
 * "Geist Mono Fallback" in packages/ui globals.css). The text must wrap the
 * same in both, so a late font never moves the page. Each case loads once
 * with Geist blocked (fallback only) and once with Geist held back 500ms
 * (the swap lands after first paint), then compares line counts and checks
 * the layout shift of the second load.
 */

const CASES = [
  { path: "/", selector: "[data-hero-fade] p" },
  { path: "/does-not-exist", selector: "main p" },
  { path: "/nope", selector: "main p" },
];
const WIDTHS = [320, 375, 768, 1024, 1440];

/** The Geist and Geist Mono files, read from the page's @font-face rules
 *  (production hashes the file names). */
async function geistUrls(browser: Browser, baseURL: string) {
  const page = await browser.newPage();
  await page.goto(`${baseURL}/does-not-exist`);
  const urls = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((rule) => ({ rule, sheet }));
        } catch {
          return [];
        }
      })
      .filter(
        (x): x is { rule: CSSFontFaceRule; sheet: CSSStyleSheet } =>
          x.rule instanceof CSSFontFaceRule &&
          /geist/i.test(x.rule.style.getPropertyValue("font-family")) &&
          !/fallback/i.test(x.rule.style.getPropertyValue("font-family"))
      )
      .map(({ rule, sheet }) => {
        const src = rule.style.getPropertyValue("src");
        const url = src.match(/url\("?([^")]+)"?\)/)?.[1] ?? "";
        return new URL(url, sheet.href ?? location.href).pathname;
      })
      .filter((path) => path.endsWith(".woff2"))
  );
  await page.close();
  return urls;
}

/** Line boxes of an element's text: distinct rows of its client rects. */
async function measure(
  browser: Browser,
  url: string,
  width: number,
  selector: string,
  geist: string[],
  mode: "blocked" | "late"
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  const page = await context.newPage();
  await page.route(
    (u) => geist.includes(u.pathname),
    async (route) => {
      if (mode === "blocked") {
        await route.abort();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    }
  );
  await page.addInitScript(() => {
    (window as unknown as { cls: number }).cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) {
          (window as unknown as { cls: number }).cls += entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(url);
  await page.waitForTimeout(1800);
  const result = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(el);
    const rows = new Set(
      [...range.getClientRects()]
        .filter((r) => r.width > 0)
        .map((r) => Math.round(r.top + r.height / 2))
    );
    // Rects on one line can differ by a pixel (inline code padding).
    const tops = [...rows].sort((a, b) => a - b);
    const lines = tops.filter((t, i) => i === 0 || t - (tops[i - 1] ?? 0) > 4);
    return {
      lines: lines.length,
      cls: (window as unknown as { cls: number }).cls,
    };
  }, selector);
  await context.close();
  return result;
}

test.describe("Geist swap", () => {
  for (const { path, selector } of CASES) {
    test(`${path} wraps the same in the fallback`, async ({
      browser,
      baseURL,
    }) => {
      const base = baseURL ?? "http://localhost:3200";
      const geist = await geistUrls(browser, base);
      expect(geist.length).toBeGreaterThanOrEqual(2);
      for (const width of WIDTHS) {
        const fallback = await measure(
          browser,
          base + path,
          width,
          selector,
          geist,
          "blocked"
        );
        const swapped = await measure(
          browser,
          base + path,
          width,
          selector,
          geist,
          "late"
        );
        expect(swapped.lines, `${path} at ${width}px`).toBe(fallback.lines);
        expect(swapped.cls, `${path} at ${width}px`).toBeLessThan(0.005);
      }
    });
  }
});
