/**
 * Regenerates the status icons in apps/web/public/email/icons: every Lucide
 * icon in `ICONS`, in each panel tone colour, as a 28px PNG (2x for the 14px
 * slot in the status chip).
 *
 *   pnpm --filter @workspace/email icons
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { emailIconFile } from "../src/assets";
import { ICONS, TONES } from "../src/content";
import { defaultTheme } from "../src/theme";

const here = dirname(fileURLToPath(import.meta.url));
const publicEmail = resolve(here, "../../../apps/web/public/email");
const require = createRequire(import.meta.url);
// The CommonJS entry is dist/cjs/lucide-react.js; the per-icon ES modules
// with the raw SVG nodes are in dist/esm/icons.
const lucideDir = join(
  dirname(require.resolve("lucide-react")),
  "..",
  "esm",
  "icons"
);

type Node = [string, Record<string, string>][];

function svg(icon: string, color: string): string {
  const source = readFileSync(join(lucideDir, `${icon}.mjs`), "utf8");
  const match = source.match(/node: (\[[\s\S]*?\n {2}\])/);
  if (!match?.[1]) {
    throw new Error(`Couldn't read the Lucide source for ${icon}`);
  }
  const node = JSON.parse(
    match[1].replace(/(\w+):/g, '"$1":').replace(/,\s*\]/g, "]")
  ) as Node;
  const children = node
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .filter(([k]) => k !== "key")
          .map(([k, v]) => `${k}="${v}"`)
          .join(" ")}/>`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const icon of ICONS) {
    for (const tone of TONES) {
      await page.setContent(
        `<body style="margin:0;background:transparent">${svg(icon, defaultTheme.panel[tone])}</body>`
      );
      const png = await page
        .locator("svg")
        .screenshot({ omitBackground: true });
      writeFileSync(join(publicEmail, emailIconFile(icon, tone)), png);
    }
  }
  console.log(`${ICONS.length * TONES.length} icons in ${publicEmail}/icons`);
} finally {
  await browser.close();
}
