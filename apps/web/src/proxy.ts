import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { contentSecurityPolicy, newNonce } from "@/lib/security-headers";

/**
 * Runs for every page request:
 * 1. A per-request CSP nonce. Next reads it from the request's CSP header
 *    and puts it on its own scripts; the root layout passes `x-nonce` to
 *    the theme script.
 * 2. Under /app, a cheap redirect when there is no session cookie. It does
 *    not authorize anything: membership, roles and entitlements are checked
 *    in the `/app/[orgSlug]` layout and in every route handler.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = contentSecurityPolicy({
    nonce,
    dev: process.env.NODE_ENV === "development",
  });

  const { pathname } = request.nextUrl;
  const inApp = pathname === "/app" || pathname.startsWith("/app/");
  if (inApp && !getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set(
      "callbackURL",
      request.nextUrl.pathname + request.nextUrl.search
    );
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Pages only: not API routes (next.config.ts gives them a deny-all
    // CSP), Next's static files, or files from public/.
    "/((?!api/|_next/static|_next/image|favicon.ico|email/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|txt|xml|webmanifest)$).*)",
  ],
};
