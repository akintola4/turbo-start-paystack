import "server-only";

import { type AuthService, createAuth } from "@workspace/auth/server";
import {
  type BillingService,
  createBillingService,
  createPaystackClient,
} from "@workspace/billing";
import { createDb, type Database } from "@workspace/db";
import {
  createEmailSender,
  createMailer,
  type EmailSender,
} from "@workspace/email";
import { env } from "@workspace/env/server";

import { deleteBlock, deleteBlockMessage } from "@/lib/org-settings";

import { notifyBillingAdmins } from "./billing-emails";
import { authRateLimitScale } from "./dev-billing";
import { invoicingFromEnv } from "./invoicing-config";

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
    allowLogInProduction: env.EMAIL_TRANSPORT === "log",
  });
  const mailer = createMailer({
    send: sendEmail,
    appUrl: env.BETTER_AUTH_URL,
    theme: {
      productName: env.EMAIL_BRAND_NAME,
      logoUrl: env.EMAIL_LOGO_URL,
      supportUrl: env.EMAIL_SUPPORT_URL,
    },
    // The local Paystack mock serves its manage-card page from its own origin.
    paystackOrigins:
      env.PAYSTACK_API_URL === "https://api.paystack.co"
        ? []
        : [new URL(env.PAYSTACK_API_URL).origin],
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
    trialMode: env.BILLING_TRIAL_MODE,
    notify: (notification) => notifyBillingAdmins({ db, mailer }, notification),
    invoicing: invoicingFromEnv(),
  });
  const authService = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    mailer,
    clientIpHeader: env.CLIENT_IP_HEADER,
    authRateLimitScale: authRateLimitScale(env),
    // Plan limits are enforced on the server when inviting (PLAN §2.3 #16).
    memberLimit: async (organizationId) =>
      (await billing.getEntitlement(organizationId)).plan.limits.members,
    // A renewing or past-due paid plan blocks the delete (cancel it in
    // Billing first). A trial is cancelled through the billing service so
    // Paystack never charges it; a plan already set to end needs nothing.
    beforeDeleteOrganization: async (organizationId) => {
      const sub = await billing.getSubscription(organizationId);
      const block = deleteBlock(sub);
      if (block) {
        return { blocked: deleteBlockMessage(block) };
      }
      if (sub?.status === "trialing") {
        await billing.cancel({
          organizationId,
          actor: { userId: "system", email: "", emailVerified: false },
        });
      }
      return undefined;
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
