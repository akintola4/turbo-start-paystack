import "server-only";

import {
  type AuthService,
  createAuth,
  roleHasPermission,
} from "@workspace/auth/server";
import {
  type BillingNotification,
  type BillingService,
  createBillingService,
  createPaystackClient,
} from "@workspace/billing";
import { createDb, type Database, schema } from "@workspace/db";
import { createEmailSender, type EmailSender } from "@workspace/email";
import { env } from "@workspace/env/server";
import { Logger } from "@workspace/logger";
import { eq } from "drizzle-orm";

const logger = new Logger("web");

type ServerContext = {
  db: Database;
  authService: AuthService;
  billing: BillingService;
  sendEmail: EmailSender;
};

function createServerContext(): ServerContext {
  const db = createDb(env.DATABASE_URL);
  const sendEmail = createEmailSender({
    from: env.EMAIL_FROM,
    resendApiKey: env.RESEND_API_KEY,
  });
  const billing = createBillingService({
    db,
    paystack: createPaystackClient({
      secretKey: env.PAYSTACK_SECRET_KEY,
      baseUrl: env.PAYSTACK_API_URL,
    }),
    encryptionKey: env.BILLING_ENCRYPTION_KEY,
    callbackUrl: `${env.BETTER_AUTH_URL}/billing/callback`,
    graceDays: env.BILLING_GRACE_DAYS,
    notify: (notification) => notifyBillingAdmins(db, sendEmail, notification),
  });
  const authService = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    sendEmail,
    // Plan limits are enforced on the server when inviting (PLAN §2.3 #16).
    memberLimit: async (organizationId) =>
      (await billing.getEntitlement(organizationId)).plan.limits.members,
    beforeDeleteOrganization: async (organizationId) => {
      const sub = await billing.getSubscription(organizationId);
      if (sub && ["active", "trialing", "past_due"].includes(sub.status)) {
        await billing.cancel({
          organizationId,
          actor: { userId: "system", email: "" },
        });
      }
    },
  });
  return { db, authService, billing, sendEmail };
}

const globalForContext = globalThis as unknown as {
  __serverContext?: ServerContext;
};

/** Process-wide singletons (one DB pool, one Better Auth instance, one
 *  billing service). Cached on globalThis so dev reloads reuse the pool. */
export function getServerContext(): ServerContext {
  globalForContext.__serverContext ??= createServerContext();
  return globalForContext.__serverContext;
}

/** Emails everyone who can manage billing in the organization. */
async function notifyBillingAdmins(
  db: Database,
  sendEmail: EmailSender,
  notification: BillingNotification
) {
  const members = await db
    .select({ email: schema.user.email, role: schema.member.role })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, notification.organizationId));
  const recipients = members.filter((m) =>
    roleHasPermission(m.role, "billing:manage")
  );
  const message = describe(notification);
  for (const recipient of recipients) {
    try {
      await sendEmail({ to: recipient.email, ...message });
    } catch (error) {
      logger.error("billing notification failed", { error: String(error) });
    }
  }
}

function describe(n: BillingNotification): { subject: string; text: string } {
  switch (n.type) {
    case "past_due":
      return {
        subject: "Your payment failed",
        text: `We couldn't charge your card for your subscription. Update your card to keep access${n.manageLink ? `: ${n.manageLink}` : " from the billing page."}`,
      };
    case "expiring_card":
      return {
        subject: "Your card is about to expire",
        text: "The card on your subscription expires soon. Update it from the billing page.",
      };
    case "trial_started":
      return {
        subject: "Your trial has started",
        text: `Your trial runs until ${n.trialEndsAt.toDateString()}. Your card will be charged then unless you cancel.`,
      };
    default:
      return {
        subject: "A payment was disputed",
        text: `Payment ${n.reference} was disputed. Check your Paystack dashboard.`,
      };
  }
}
