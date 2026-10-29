import { createHash } from "node:crypto";

import {
  appLink,
  normalizeAppUrl,
  paystackLink,
  requireAppOrigin,
} from "./links";
import { renderEmail } from "./render";
import type {
  CardExpiringProps,
  OrganizationInvitationProps,
  PaymentDisputedProps,
  PaymentFailedProps,
  PaymentReceiptProps,
  PlanChangedProps,
  SubscriptionCanceledProps,
  TemplateName,
  TemplateProps,
  TrialEndingProps,
  TrialStartedProps,
} from "./templates/index";
import {
  createTheme,
  type EmailTheme,
  type EmailThemeOverrides,
} from "./theme";
import type { EmailSender } from "./transport";

export type MailerOptions = {
  send: EmailSender;
  /** Public app URL (BETTER_AUTH_URL). Every app link is built from it. */
  appUrl: string;
  theme?: EmailThemeOverrides;
  /** Origins accepted for Paystack links besides paystack.com/.co, e.g. the
   *  local mock's. */
  paystackOrigins?: string[];
};

/** Routes in apps/web that emails link to. */
const routes = {
  acceptInvite: (id: string) => ["accept-invite", id],
  billing: (slug: string) => ["app", slug, "settings", "billing"],
};

type Recipient = {
  to: string;
  /** Natural key of the event (webhook reference, subscription + date…).
   *  Combined with the recipient into Resend's Idempotency-Key. */
  key?: string;
};

type BillingInput<P> = Recipient &
  Omit<P, "billingUrl"> & {
    organizationSlug: string;
  };

export function idempotencyKey(key: string, to: string): string {
  return createHash("sha256")
    .update(`${key}\n${to.toLowerCase()}`)
    .digest("hex");
}

export function createMailer(options: MailerOptions) {
  const appUrl = normalizeAppUrl(options.appUrl);
  // Fonts and status icons are served by the app from /email
  // (apps/web/public/email); a theme can point elsewhere or turn them off.
  const theme: EmailTheme = createTheme({
    assetsUrl: `${appUrl}/email`,
    ...options.theme,
  });
  const billingUrl = (slug: string) => appLink(appUrl, routes.billing(slug));
  const manageUrl = (link: string | undefined, slug: string) =>
    paystackLink(link, options.paystackOrigins) ?? billingUrl(slug);

  async function send<N extends TemplateName>(
    name: N,
    recipient: Recipient,
    props: TemplateProps<N>
  ) {
    const rendered = await renderEmail(name, props, theme);
    await options.send({
      to: recipient.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: recipient.key
        ? idempotencyKey(recipient.key, recipient.to)
        : undefined,
    });
  }

  return {
    theme,

    verifyEmail: async (input: Recipient & { name?: string; url: string }) =>
      send("verify-email", input, {
        name: input.name,
        url: requireAppOrigin(input.url, appUrl),
      }),

    resetPassword: async (input: Recipient & { name?: string; url: string }) =>
      send("reset-password", input, {
        name: input.name,
        url: requireAppOrigin(input.url, appUrl),
      }),

    organizationInvitation: async (
      input: Recipient &
        Omit<OrganizationInvitationProps, "acceptUrl" | "recipientEmail"> & {
          invitationId: string;
        }
    ) =>
      send("organization-invitation", input, {
        inviterName: input.inviterName,
        inviterEmail: input.inviterEmail,
        organizationName: input.organizationName,
        role: input.role,
        expiresInDays: input.expiresInDays,
        recipientEmail: input.to,
        acceptUrl: appLink(appUrl, routes.acceptInvite(input.invitationId)),
      }),

    paymentReceipt: async (input: BillingInput<PaymentReceiptProps>) =>
      send("payment-receipt", input, {
        organizationName: input.organizationName,
        planName: input.planName,
        interval: input.interval,
        amountSubunit: input.amountSubunit,
        currency: input.currency,
        reference: input.reference,
        paidAt: input.paidAt,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        billingUrl: billingUrl(input.organizationSlug),
      }),

    paymentFailed: async (
      input: BillingInput<Omit<PaymentFailedProps, "manageUrl">> & {
        /** From Paystack's manage-link API; checked before use. */
        manageLink?: string;
      }
    ) =>
      send("payment-failed", input, {
        organizationName: input.organizationName,
        planName: input.planName,
        graceUntil: input.graceUntil,
        manageUrl: manageUrl(input.manageLink, input.organizationSlug),
        billingUrl: billingUrl(input.organizationSlug),
      }),

    trialEnding: async (input: BillingInput<TrialEndingProps>) =>
      send("trial-ending", input, {
        organizationName: input.organizationName,
        planName: input.planName,
        interval: input.interval,
        trialEndsAt: input.trialEndsAt,
        amountSubunit: input.amountSubunit,
        currency: input.currency,
        billingUrl: billingUrl(input.organizationSlug),
      }),

    subscriptionCanceled: async (
      input: Recipient &
        Omit<SubscriptionCanceledProps, "resumeUrl"> & {
          organizationSlug: string;
        }
    ) =>
      send("subscription-canceled", input, {
        organizationName: input.organizationName,
        planName: input.planName,
        accessUntil: input.accessUntil,
        resumeUrl: billingUrl(input.organizationSlug),
      }),

    planChanged: async (input: BillingInput<PlanChangedProps>) =>
      send("plan-changed", input, {
        organizationName: input.organizationName,
        change: input.change,
        fromPlan: input.fromPlan,
        toPlan: input.toPlan,
        chargedSubunit: input.chargedSubunit,
        currency: input.currency,
        effectiveAt: input.effectiveAt,
        billingUrl: billingUrl(input.organizationSlug),
      }),

    trialStarted: async (input: BillingInput<TrialStartedProps>) =>
      send("trial-started", input, {
        organizationName: input.organizationName,
        planName: input.planName,
        trialEndsAt: input.trialEndsAt,
        billingUrl: billingUrl(input.organizationSlug),
      }),

    cardExpiring: async (
      input: Recipient &
        Omit<CardExpiringProps, "manageUrl"> & {
          organizationSlug: string;
          manageLink?: string;
        }
    ) =>
      send("card-expiring", input, {
        organizationName: input.organizationName,
        manageUrl: manageUrl(input.manageLink, input.organizationSlug),
      }),

    paymentDisputed: async (input: BillingInput<PaymentDisputedProps>) =>
      send("payment-disputed", input, {
        organizationName: input.organizationName,
        reference: input.reference,
        billingUrl: billingUrl(input.organizationSlug),
      }),
  };
}

export type Mailer = ReturnType<typeof createMailer>;
/** The part of the mailer that packages/auth needs. */
export type AuthMailer = Pick<
  Mailer,
  "verifyEmail" | "resetPassword" | "organizationInvitation"
>;
