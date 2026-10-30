import { isAuthError } from "@workspace/auth/permissions";
import { schema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getServerContext } from "@/server/context";

export const metadata = { title: "Confirming payment" };

/**
 * Paystack redirects here after checkout. The reference is confirmed on the
 * server with GET /transaction/verify (whichever of this or the webhook comes
 * first wins; the other is a no-op). Nothing in the query string is trusted.
 */
export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const requestHeaders = await headers();
  const { reference, trxref } = await searchParams;
  const ref = reference ?? trxref;
  if (!ref) {
    notFound();
  }
  const { db, authService, billing } = getServerContext();
  const [intent] = await db
    .select({
      organizationId: schema.paymentIntent.organizationId,
      slug: schema.organization.slug,
    })
    .from(schema.paymentIntent)
    .innerJoin(
      schema.organization,
      eq(schema.paymentIntent.organizationId, schema.organization.id)
    )
    .where(eq(schema.paymentIntent.id, ref));
  if (!intent) {
    notFound();
  }
  try {
    await authService.requirePermission(
      requestHeaders,
      intent.organizationId,
      "billing:view"
    );
  } catch (error) {
    // Signed out or not allowed: sign in and come back. Anything else (a
    // database error) is a real failure and goes to the error boundary.
    if (!isAuthError(error)) {
      throw error;
    }
    redirect(
      `/sign-in?callbackURL=${encodeURIComponent(`/billing/callback?reference=${ref}`)}`
    );
  }
  const result = await billing.confirmByReference(intent.organizationId, ref);
  redirect(
    `/app/${intent.slug}/settings/billing?payment=${result.paymentStatus}`
  );
}
