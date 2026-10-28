import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Cheap redirect only: checks that a session cookie exists. It does not
 * authorize anything. Membership, roles and entitlements are checked in the
 * `/app/[orgSlug]` layout and in every route handler.
 *
 * Throwaway (redesign preview): `?theme=a|b|c` on any page sets the design
 * direction cookie and redirects to the clean URL.
 */
export function proxy(request: NextRequest) {
  const theme = request.nextUrl.searchParams.get("theme");
  if (theme === "a" || theme === "b" || theme === "c") {
    const url = request.nextUrl.clone();
    url.searchParams.delete("theme");
    const response = NextResponse.redirect(url);
    response.cookies.set("tsp-direction", theme, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }
  if (
    request.nextUrl.pathname.startsWith("/app") &&
    !getSessionCookie(request)
  ) {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
