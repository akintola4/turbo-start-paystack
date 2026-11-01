import { expect, test } from "@playwright/test";

import { STATE } from "./users";

/*
 * The landing header knows who is signed in: visitors get "Sign in" and the
 * demo sign-up, signed-in users get a way back into the app instead of being
 * asked to sign in again. Needs the database (the demo owner's session).
 */

test("a visitor is offered sign in and the demo", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("navigation", { name: "Primary" });
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in"
  );
  await expect(
    page.getByRole("link", { name: "Try the live demo" })
  ).toHaveAttribute("href", "/sign-up");
});

test.describe("signed in", () => {
  test.use({ storageState: STATE.ada });

  test("a signed-in user is offered the dashboard", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("navigation", { name: "Primary" });
    await expect(
      header.getByRole("link", { name: "Dashboard" })
    ).toHaveAttribute("href", "/app");
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Open your dashboard" })
    ).toHaveAttribute("href", "/app");
  });
});
