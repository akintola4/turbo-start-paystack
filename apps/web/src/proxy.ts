import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Cheap redirect only: checks that a session cookie exists. It does not
 * authorize anything. Membership, roles and entitlements are checked in the
 * `/app/[orgSlug]` layout and in every route handler.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set(
      "callbackURL",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
