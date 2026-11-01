import { readFileSync } from "node:fs";
import type { APIRequestContext, Cookie } from "@playwright/test";

/*
 * The demo users from scripts/setup/seed.ts, plus the viewer `pnpm e2e`
 * seeds. The setup project (setup.setup.ts) signs each in once and saves the
 * session, so specs reuse it with `test.use({ storageState: STATE.ada })`
 * instead of signing in again: Better Auth allows five sign-ins a minute.
 */

export const PASSWORD = process.env.E2E_PASSWORD ?? "kola-demo-2026";
export const SLUG = "kola-logistics";
export const ORG = `/app/${SLUG}`;

export const USERS = {
  ada: "ada@kolalogistics.test", // owner
  tunde: "tunde@kolalogistics.test", // billing
  chioma: "chioma@kolalogistics.test", // member
  wanjiru: "wanjiru@kolalogistics.test", // viewer
} as const;

export type DemoUser = keyof typeof USERS;

const dir = new URL("./.auth/", import.meta.url).pathname;

export const STATE = Object.fromEntries(
  Object.keys(USERS).map((key) => [key, `${dir}${key}.json`])
) as Record<DemoUser, string>;

/** The saved session's cookies, for a spec that switches users on one page
 *  (`page.context().addCookies(cookiesOf("chioma"))`). */
export function cookiesOf(user: DemoUser): Cookie[] {
  return (
    JSON.parse(readFileSync(STATE[user], "utf8")) as { cookies: Cookie[] }
  ).cookies;
}

/** POST /sign-in/email, waiting out a 429. Only for tests about signing in
 *  and for the setup project: everything else uses STATE. */
export async function signIn(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  password = PASSWORD
) {
  for (let attempt = 0; ; attempt++) {
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email, password },
      headers: { origin: baseURL },
    });
    if (res.status() !== 429 || attempt === 2) {
      return res;
    }
    const wait = Number(res.headers()["x-retry-after"] ?? 60);
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
  }
}
