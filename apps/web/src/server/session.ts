import "server-only";

import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

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
