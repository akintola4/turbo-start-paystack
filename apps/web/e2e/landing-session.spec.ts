import { expect, test } from "@playwright/test";

/*
 * The landing header knows who is signed in: visitors get "Sign in" and the
 * demo sign-up, signed-in users get a way back into the app instead of being
 * asked to sign in again. Needs the database (it signs in as the demo owner).
 */

const PASSWORD = process.env.E2E_PASSWORD ?? "kola-demo-2026";

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

test("a signed-in user is offered the dashboard", async ({ page, baseURL }) => {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "ada@kolalogistics.test", password: PASSWORD },
    headers: { origin: baseURL ?? "" },
  });
  expect(res.ok()).toBe(true);

  await page.goto("/");
  const header = page.getByRole("navigation", { name: "Primary" });
  await expect(header.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "href",
    "/app"
  );
  await expect(header.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open your dashboard" })
  ).toHaveAttribute("href", "/app");
});
