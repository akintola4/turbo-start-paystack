import { type Cookie, expect, type Page, test } from "@playwright/test";

/*
 * The ⌘K command palette. Run against the seeded app:
 * E2E_BASE_URL=http://localhost:3400 pnpm --filter web test:e2e e2e/command-palette.spec.ts
 */

const PASSWORD = process.env.E2E_PASSWORD ?? "kola-demo-2026";
const ORG = "/app/kola-logistics";
const sessions: Record<string, Cookie[]> = {};

// One sign-in per person: the auth endpoint rate-limits repeated sign-ins.
test.beforeAll(async ({ browser }) => {
  for (const email of ["ada@kolalogistics.test", "chioma@kolalogistics.test"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/sign-in");
    const res = await page.request.post("/api/auth/sign-in/email", {
      data: { email, password: PASSWORD },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(res.ok()).toBe(true);
    sessions[email] = await context.cookies();
    await context.close();
  }
});

async function openAs(page: Page, email: string) {
  await page.context().addCookies(sessions[email] ?? []);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(ORG, { waitUntil: "networkidle" });
  await page.locator("[data-command-trigger]").waitFor();
}

const palette = (page: Page) => page.getByRole("dialog", { name: "Search" });
const input = (page: Page) =>
  palette(page).locator("[data-slot=command-input]");
const options = (page: Page) => palette(page).getByRole("option");

test("⌘K opens the palette with the input focused; Esc returns focus to the trigger", async ({
  page,
}) => {
  await openAs(page, "ada@kolalogistics.test");
  await page.locator("[data-command-trigger]").focus();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await expect(options(page).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
  await expect(page.locator("[data-command-trigger]")).toBeFocused();
});

test("searching an invoice number and pressing Enter opens that invoice", async ({
  page,
}) => {
  await openAs(page, "ada@kolalogistics.test");
  await page.locator("[data-command-trigger]").click();
  await input(page).fill("INV-");
  const first = options(page)
    .filter({ hasText: /^INV-\d{4}-\d+/ })
    .first();
  await expect(first).toBeVisible();
  const number = (await first.innerText()).split("\n")[0] ?? "";

  await input(page).fill(number);
  await expect(options(page).first()).toContainText(number);
  // The live region announces the count.
  await expect(palette(page).locator("[data-palette-count]")).toHaveText(
    /\d+ results?/
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings\/billing\/invoices\/[\w-]+$/);
  await expect(page.getByText(number).first()).toBeVisible();
});

test("a member sees no billing pages, billing actions or invoices", async ({
  page,
}) => {
  await openAs(page, "chioma@kolalogistics.test");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeVisible();
  const all = await options(page).allInnerTexts();
  expect(all.join("|")).not.toMatch(
    /Billing|Invoices|Update card|Change plan|Invite/
  );

  for (const query of ["bill", "INV-", "paid", "card"]) {
    await input(page).fill(query);
    await expect(palette(page).locator("[data-palette-count]")).toHaveText(
      /results?$/
    );
    // Titles only: a member's subtitle may name their role ("Billing").
    const titles = (await options(page).allInnerTexts()).map(
      (t) => t.split("\n")[0] ?? ""
    );
    for (const title of titles) {
      expect(title).not.toMatch(
        /^(INV-\d|Billing|Invoices|Update card|Change plan)/
      );
    }
  }
  // The server answers without invoices, too.
  const response = page.waitForResponse((r) =>
    r.url().includes("/search?q=INV")
  );
  await input(page).fill("INV");
  const body = (await (await response).json()) as {
    results: { item: { group: string } }[];
  };
  expect(body.results.some((r) => r.item.group === "Invoices")).toBe(false);
});

for (const scheme of ["light", "dark"] as const) {
  test(`${scheme}: the highlighted result stands out from the list`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openAs(page, "ada@kolalogistics.test");
    await page.keyboard.press("ControlOrMeta+k");
    await input(page).fill("me");
    await page.keyboard.press("ArrowDown");
    const highlighted = palette(page).locator("[data-highlighted]");
    await expect(highlighted).toHaveCount(1);
    const { item, list } = await highlighted.evaluate((el) => {
      const surface = el.closest("[data-slot=command]");
      return {
        item: getComputedStyle(el).backgroundColor,
        list: surface ? getComputedStyle(surface).backgroundColor : "",
      };
    });
    expect(item).not.toBe(list);
    if (scheme === "dark") {
      // Relative luminance from the computed lab() lightness (L*).
      const lum = (c: string) => {
        const l = Number(/lab\(([\d.]+)/.exec(c)?.[1] ?? Number.NaN);
        return ((l + 16) / 116) ** 3;
      };
      const [a, b] = [lum(item), lum(list)].sort((x, y) => x - y);
      expect(((b ?? 0) + 0.05) / ((a ?? 0) + 0.05)).toBeGreaterThanOrEqual(
        1.25
      );
    }
    // ⌘↵ PDF shows only while an invoice is highlighted.
    await expect(palette(page).locator("[data-pdf-hint]")).toHaveCSS(
      "opacity",
      "0"
    );
  });
}

test("ranking: 'ligt' finds Toggle theme, not Billing details", async ({
  page,
}) => {
  await openAs(page, "ada@kolalogistics.test");
  await page.keyboard.press("ControlOrMeta+k");
  await input(page).fill("ligt");
  await expect(options(page).first()).toContainText("Toggle theme");
  await expect(
    options(page).filter({ hasText: "Billing details" })
  ).toHaveCount(0);
});

test("ranking: the obvious page leads for 'mem' and 'inv'", async ({
  page,
}) => {
  await openAs(page, "ada@kolalogistics.test");
  await page.keyboard.press("ControlOrMeta+k");
  await input(page).fill("mem");
  await expect(options(page).first()).toContainText("Members");
  await expect(palette(page).locator("[data-highlighted]")).toContainText(
    "Members"
  );
  await input(page).fill("inv");
  await expect(options(page).first()).toContainText(/Invoices|INV-/);
});
