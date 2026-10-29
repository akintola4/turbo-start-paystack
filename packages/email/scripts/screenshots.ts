/**
 * Renders every template and screenshots it with Playwright: light and dark,
 * 800px desktop and 375px phone, plus three client checks for the receipt
 * and the failed payment (Gmail-style dark inversion, images off, no web
 * fonts). Fonts and icons are served from apps/web/public/email, so the
 * shots match what Apple Mail shows. No dev server needed.
 *
 *   pnpm --filter @workspace/email screenshots /tmp/email-shots
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type BrowserContext, chromium } from "@playwright/test";

import { exportAll, SAMPLE_ASSETS_URL } from "./export";

const here = dirname(fileURLToPath(import.meta.url));
const publicEmail = resolve(here, "../../../apps/web/public/email");
const outDir = resolve(process.argv[2] ?? "email-shots");
const htmlDir = join(outDir, "html");
const CHECKED = ["payment-receipt", "payment-failed"];

/**
 * Approximates the Gmail app in dark mode: Gmail's <body> rewrite, our
 * prefers-color-scheme and [data-og*] rules ignored (Gmail keeps the rest of
 * <style>), then light backgrounds and borders darkened and dark text
 * lightened. Dark backgrounds and light text are left alone.
 */
function invert() {
  // Gmail's rewrite: <body class="x"> becomes <u></u><div class="x">, which
  // is what `u + .body` selectors rely on.
  const wrapper = document.createElement("div");
  wrapper.className = document.body.className;
  wrapper.style.cssText = document.body.style.cssText;
  wrapper.append(...document.body.childNodes);
  document.body.removeAttribute("class");
  document.body.append(document.createElement("u"), wrapper);
  for (const style of document.querySelectorAll("style")) {
    style.textContent = (style.textContent ?? "")
      .replace(
        /@media \(prefers-color-scheme:dark\)\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g,
        ""
      )
      .replace(/\[data-og[sb][bc]?\][^}]*\}/g, "");
  }
  type Rgb = { r: number; g: number; b: number; a: number };
  const parse = (c: string): Rgb | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m?.[1]) {
      return null;
    }
    const [r = 0, g = 0, b = 0, a = 1] = m[1].split(",").map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }: Rgb) => {
    const f = (v: number) => {
      const x = v / 255;
      return x <= 0.039_28 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const flip = ({ r, g, b }: Rgb, floor: number) => {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const target = Math.max(floor, 1 - l);
    const k = l === 0 ? 0 : target / l;
    const ch = (v: number) => Math.round(Math.min(255, v * k));
    return `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`;
  };
  const darken = (el: HTMLElement, cs: CSSStyleDeclaration) => {
    const bg = parse(cs.backgroundColor);
    if (bg && bg.a > 0 && lum(bg) > 0.35) {
      el.style.setProperty("background-color", flip(bg, 0.07), "important");
    }
    const fg = parse(cs.color);
    if (fg && lum(fg) < 0.35) {
      el.style.setProperty("color", flip(fg, 0.85), "important");
    }
  };
  const darkenBorders = (el: HTMLElement, cs: CSSStyleDeclaration) => {
    for (const side of ["top", "right", "bottom", "left"]) {
      const bc = parse(cs.getPropertyValue(`border-${side}-color`));
      const width = Number.parseFloat(
        cs.getPropertyValue(`border-${side}-width`)
      );
      if (bc && width > 0 && lum(bc) > 0.35) {
        el.style.setProperty(
          `border-${side}-color`,
          flip(bc, 0.1),
          "important"
        );
      }
    }
  };
  for (const el of document.querySelectorAll<HTMLElement>("*")) {
    const cs = getComputedStyle(el);
    darken(el, cs);
    darkenBorders(el, cs);
  }
  const body = parse(getComputedStyle(document.body).backgroundColor);
  if (!body || lum(body) > 0.35) {
    document.body.style.background = "#121212";
  }
}

type Shot = {
  width: number;
  scheme?: "light" | "dark";
  fonts?: boolean;
  images?: boolean;
  inverted?: boolean;
};

async function serveAssets(
  ctx: BrowserContext,
  { fonts = true, images = true }: Shot
) {
  await ctx.route(`${SAMPLE_ASSETS_URL}/**`, (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      /^\/email\//,
      ""
    );
    const isFont = path.startsWith("fonts/");
    const file = join(publicEmail, path);
    if ((isFont && !fonts) || (!isFont && !images) || !existsSync(file)) {
      return route.abort();
    }
    return route.fulfill({
      body: readFileSync(file),
      contentType: isFont ? "font/woff2" : "image/png",
    });
  });
}

await mkdir(outDir, { recursive: true });
const slugs = await exportAll(htmlDir);
const browser = await chromium.launch();
let count = 0;
try {
  const shoot = async (slug: string, name: string, shot: Shot) => {
    const ctx = await browser.newContext({
      colorScheme: shot.scheme ?? "light",
      deviceScaleFactor: 2,
      viewport: { width: shot.width, height: 800 },
    });
    await serveAssets(ctx, shot);
    // tsx (esbuild keepNames) wraps functions in __name(), which doesn't
    // exist in the page that `invert` is serialised into.
    await ctx.addInitScript("window.__name = (fn) => fn");
    const page = await ctx.newPage();
    await page.goto(`file://${join(htmlDir, `${slug}.html`)}`);
    await page.evaluate(() => document.fonts.ready);
    if (shot.inverted) {
      await page.evaluate(invert);
    }
    await page.screenshot({
      fullPage: true,
      path: join(outDir, `${slug}-${name}.png`),
    });
    await ctx.close();
    count += 1;
  };
  for (const slug of slugs) {
    for (const scheme of ["light", "dark"] as const) {
      await shoot(slug, `${scheme}-desktop`, { scheme, width: 800 });
      await shoot(slug, `${scheme}-mobile`, { scheme, width: 375 });
    }
    if (CHECKED.includes(slug)) {
      await shoot(slug, "gmail-invert-mobile", { inverted: true, width: 375 });
      await shoot(slug, "images-off-desktop", { images: false, width: 800 });
      await shoot(slug, "no-webfont-desktop", { fonts: false, width: 800 });
    }
  }
} finally {
  await browser.close();
}
console.log(`${count} screenshots in ${outDir}`);
