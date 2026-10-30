import "server-only";

import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { postAuthLanding, safeCallback } from "@/lib/safe-callback";

import { getServerContext } from "./context";

export async function requireSession(callbackPath = "/app") {
  // Read request headers first: it opts the page out of prerendering before
  // anything touches the database or auth config.
  const requestHeaders = await headers();
  const { authService } = getServerContext();
  const session = await authService.auth.api.getSession({
    headers: requestHeaders,
  });
  if (!session) {
    redirect(`/sign-in?callbackURL=${encodeURIComponent(callbackPath)}`);
  }
  return session;
}

/** Whether someone is signed in, for pages anyone can see (the landing). */
export async function isSignedIn() {
  const requestHeaders = await headers();
  const { authService } = getServerContext();
  const session = await authService.auth.api.getSession({
    headers: requestHeaders,
  });
  return session !== null;
}

/**
 * Sign-in and sign-up: a verified session skips the form and goes where the
 * form would have sent it, the safe `callbackURL` or the dashboard.
 * An unverified session stays on the form, where signing in resends its link.
 * `/app` only sends you here without a session, so the two can't loop.
 */
export async function redirectIfSignedIn(
  callbackURL: string | string[] | undefined
) {
  const requestHeaders = await headers();
  const { authService } = getServerContext();
  const session = await authService.auth.api.getSession({
    headers: requestHeaders,
  });
  if (session?.user.emailVerified) {
    redirect(
      postAuthLanding(
        safeCallback(typeof callbackURL === "string" ? callbackURL : null)
      )
    );
  }
}

/** Membership for `/app/[orgSlug]`. Non-members get a 404 so slugs of other
 *  tenants don't leak. */
export async function requireOrgBySlug(slug: string) {
  const requestHeaders = await headers();
  const { authService } = getServerContext();
  const membership = await authService.getMembershipBySlug(
    requestHeaders,
    slug
  );
  if (!membership) {
    notFound();
  }
  return membership;
}

export async function listMyOrganizations(userId: string) {
  const { db } = getServerContext();
  return db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      role: schema.member.role,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id)
    )
    .where(eq(schema.member.userId, userId))
    .orderBy(schema.organization.name);
}
