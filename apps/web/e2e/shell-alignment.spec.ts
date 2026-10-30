import { type Cookie, expect, type Page, test } from "@playwright/test";

/*
 * The app shell grid: the top bar is centred on the sidebar's org row, the
 * toggle's ink, the title's ink and the content column share one left edge,
 * and page actions centre on the title's first line. Run against a seeded
 * app: E2E_BASE_URL=http://localhost:3400 pnpm --filter web test:e2e
 * e2e/shell-alignment.spec.ts
 */

const PASSWORD = process.env.E2E_PASSWORD ?? "kola-demo-2026";
const ORG = "/app/kola-logistics";
const PAGES = {
  Overview: ORG,
  Members: `${ORG}/members`,
  Billing: `${ORG}/settings/billing`,
};

async function signIn(page: Page, email = "ada@kolalogistics.test") {
  await page.goto("/sign-in");
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: PASSWORD },
    headers: { origin: new URL(page.url() || "http://x").origin },
  });
  expect(res.ok()).toBe(true);
}

// One sign-in per run: the auth endpoint rate-limits repeated sign-ins.
let session: Cookie[] = [];
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  await signIn(await context.newPage());
  session = await context.cookies();
  await context.close();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(session);
});

/** The title's ink edge (its first glyph minus the side bearing) and the
 *  centre of its first line box. */
function titleEdges(page: Page) {
  return page.evaluate(() => {
    const h1 = document.querySelector<HTMLElement>("main h1");
    const ctx = document.createElement("canvas").getContext("2d");
    if (!(h1 && ctx)) {
      throw new Error("page not rendered");
    }
    const style = getComputedStyle(h1);
    const range = document.createRange();
    range.selectNodeContents(h1);
    const firstLine = range.getClientRects()[0] ?? h1.getBoundingClientRect();
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const glyph = ctx.measureText((h1.textContent ?? "").trim().charAt(0));
    return {
      titleInk: firstLine.left - glyph.actualBoundingBoxLeft,
      titleLineCentre:
        h1.getBoundingClientRect().top +
        Number.parseFloat(style.lineHeight) / 2,
    };
  });
}

/** Shell edges in CSS px, measured from the rendered page. */
function shellEdges(page: Page) {
  return page.evaluate(() => {
    const visible = (selector: string) =>
      [...document.querySelectorAll<HTMLElement>(selector)].find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > 0;
      }) ?? null;
    const centreY = (el: Element | null) => {
      if (!el) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    };
    const main = document.querySelector<HTMLElement>("main#content");
    if (!main) {
      throw new Error("page not rendered");
    }
    // Toggle ink: PanelLeft's rect less half its 2-unit stroke.
    const toggle = visible('[data-sidebar="trigger"]');
    const shape = toggle?.querySelector("svg rect");
    const svg = toggle?.querySelector("svg");
    const toggleInk =
      shape && svg
        ? shape.getBoundingClientRect().left -
          svg.getBoundingClientRect().width / 24
        : null;
    const firstBlock = main.querySelector("header")?.nextElementSibling;
    return {
      contentLeft:
        main.getBoundingClientRect().left +
        Number.parseFloat(getComputedStyle(main).paddingLeft),
      toggleInk,
      toggleCentre: centreY(toggle),
      orgRowCentre: centreY(visible('[data-sidebar="header"] button')),
      actionCentre: centreY(
        visible("[data-page-actions] button, [data-page-actions] a")
      ),
      firstBlockLeft: firstBlock?.getBoundingClientRect().left ?? null,
      scrollX: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

async function measure(page: Page) {
  return { ...(await shellEdges(page)), ...(await titleEdges(page)) };
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("main h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
}

for (const [name, path] of Object.entries(PAGES)) {
  test(`${name} at 1440: top bar, title and actions sit on the grid`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, path);
    const m = await measure(page);

    expect(m.toggleCentre).not.toBeNull();
    expect(m.orgRowCentre).not.toBeNull();
    expect(
      Math.abs((m.toggleCentre ?? 0) - (m.orgRowCentre ?? 0))
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(m.titleInk - m.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs((m.toggleInk ?? 0) - m.contentLeft)).toBeLessThanOrEqual(1);
    expect(
      Math.abs((m.firstBlockLeft ?? 0) - m.contentLeft)
    ).toBeLessThanOrEqual(1);
    if (m.actionCentre !== null) {
      expect(Math.abs(m.actionCentre - m.titleLineCentre)).toBeLessThanOrEqual(
        1
      );
    }
    expect(m.scrollX).toBe(0);
  });
}

test("Overview's action is centred on the title line, not the title block", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, ORG);
  const m = await measure(page);
  expect(m.actionCentre).not.toBeNull();
  expect(
    Math.abs((m.actionCentre ?? 0) - m.titleLineCentre)
  ).toBeLessThanOrEqual(1);
});

test("collapsed sidebar keeps one left edge and survives a reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, ORG);
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await page.reload();
  await page.locator("main h1").waitFor();
  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
    "data-state",
    "collapsed"
  );
  const m = await measure(page);
  expect(Math.abs(m.titleInk - m.contentLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs((m.toggleInk ?? 0) - m.contentLeft)).toBeLessThanOrEqual(1);
});

for (const [label, size] of [
  ["iPad portrait", { width: 820, height: 1180 }],
  ["iPhone", { width: 393, height: 852 }],
] as const) {
  test(`${label}: drawer toggle and title share the content edge`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    for (const path of Object.values(PAGES)) {
      await open(page, path);
      const m = await measure(page);
      expect(Math.abs(m.titleInk - m.contentLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs((m.toggleInk ?? 0) - m.contentLeft)).toBeLessThanOrEqual(
        1
      );
      expect(m.scrollX).toBe(0);
    }
  });
}

/** Gutters either side of the content column, inside the main area. */
function gutters(page: Page) {
  return page.evaluate(() => {
    const inset = document.querySelector('[data-slot="sidebar-inset"]');
    const main = document.querySelector<HTMLElement>("main#content");
    if (!(inset && main)) {
      throw new Error("shell not rendered");
    }
    const area = inset.getBoundingClientRect();
    const column = main.getBoundingClientRect();
    const style = getComputedStyle(main);
    return {
      left: column.left + Number.parseFloat(style.paddingLeft) - area.left,
      right:
        area.right - (column.right - Number.parseFloat(style.paddingRight)),
    };
  });
}

function settled(page: Page) {
  return page.waitForFunction(
    () =>
      !document
        .getAnimations()
        .some((a) => a instanceof CSSTransition && a.playState === "running")
  );
}

for (const width of [1440, 1920]) {
  test(`content column is centred at ${width}, sidebar open and collapsed`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, ORG);
    const expanded = await gutters(page);
    expect(Math.abs(expanded.left - expanded.right)).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed"
    );
    await settled(page);
    const collapsed = await gutters(page);
    expect(Math.abs(collapsed.left - collapsed.right)).toBeLessThanOrEqual(1);
    const m = await measure(page);
    expect(Math.abs(m.titleInk - m.contentLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs((m.toggleInk ?? 0) - m.contentLeft)).toBeLessThanOrEqual(1);
  });
}

test("the toggle shows a focus ring for the keyboard, not after a click", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, ORG);
  const toggle = page.getByRole("button", { name: "Toggle sidebar" });
  const outline = () =>
    toggle.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, color: s.outlineColor };
    });
  const transparent = (c: string) =>
    c === "transparent" || /rgba\(.*,\s*0\)$/.test(c);

  await toggle.click();
  await settled(page);
  await expect(toggle).toBeFocused();
  const clicked = await outline();
  expect(clicked.style === "none" || transparent(clicked.color)).toBe(true);
  await toggle.click();
  await settled(page);

  // Fresh page, then Tab from the top: the sidebar comes first in order.
  await open(page, ORG);
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    if (await toggle.evaluate((el) => el === document.activeElement)) {
      break;
    }
  }
  await expect(toggle).toBeFocused();
  await settled(page);
  const tabbed = await outline();
  expect(tabbed.style).toBe("solid");
  expect(transparent(tabbed.color)).toBe(false);
});
