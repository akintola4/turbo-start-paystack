import type { ComponentType } from "react";

import type { EmailTheme } from "../theme";
import { CardExpiring, cardExpiringSubject } from "./card-expiring";
import {
  OrganizationInvitation,
  organizationInvitationSubject,
} from "./organization-invitation";
import { PaymentDisputed, paymentDisputedSubject } from "./payment-disputed";
import { PaymentFailed, paymentFailedSubject } from "./payment-failed";
import { PaymentReceipt, paymentReceiptSubject } from "./payment-receipt";
import { PlanChanged, planChangedSubject } from "./plan-changed";
import { ResetPassword, resetPasswordSubject } from "./reset-password";
import {
  SubscriptionCanceled,
  subscriptionCanceledSubject,
} from "./subscription-canceled";
import { TrialEnding, trialEndingSubject } from "./trial-ending";
import { TrialStarted, trialStartedSubject } from "./trial-started";
import { VerifyEmail, verifyEmailSubject } from "./verify-email";

type Template<P> = {
  Component: ComponentType<P & { theme?: EmailTheme }> & { PreviewProps: P };
  subject: (props: P) => string;
};

const define = <P>(
  Component: Template<P>["Component"],
  subject: Template<P>["subject"]
): Template<P> => ({ Component, subject });

/** Every email, by name. Previews, tests and the screenshot export iterate
 *  over this, so a new template only needs adding here. */
export const templates = {
  "verify-email": define<VerifyEmailProps>(VerifyEmail, verifyEmailSubject),
  "reset-password": define<ResetPasswordProps>(
    ResetPassword,
    resetPasswordSubject
  ),
  "organization-invitation": define<OrganizationInvitationProps>(
    OrganizationInvitation,
    organizationInvitationSubject
  ),
  "payment-receipt": define<PaymentReceiptProps>(
    PaymentReceipt,
    paymentReceiptSubject
  ),
  "payment-failed": define<PaymentFailedProps>(
    PaymentFailed,
    paymentFailedSubject
  ),
  "trial-ending": define<TrialEndingProps>(TrialEnding, trialEndingSubject),
  "subscription-canceled": define<SubscriptionCanceledProps>(
    SubscriptionCanceled,
    subscriptionCanceledSubject
  ),
  "plan-changed": define<PlanChangedProps>(PlanChanged, planChangedSubject),
  "trial-started": define<TrialStartedProps>(TrialStarted, trialStartedSubject),
  "card-expiring": define<CardExpiringProps>(CardExpiring, cardExpiringSubject),
  "payment-disputed": define<PaymentDisputedProps>(
    PaymentDisputed,
    paymentDisputedSubject
  ),
};

export type TemplateName = keyof typeof templates;
export type TemplateProps<N extends TemplateName> = Parameters<
  (typeof templates)[N]["subject"]
>[0];

import type { CardExpiringProps } from "./card-expiring";
import type { OrganizationInvitationProps } from "./organization-invitation";
import type { PaymentDisputedProps } from "./payment-disputed";
import type { PaymentFailedProps } from "./payment-failed";
import type { PaymentReceiptProps } from "./payment-receipt";
import type { PlanChangedProps } from "./plan-changed";
import type { ResetPasswordProps } from "./reset-password";
import type { SubscriptionCanceledProps } from "./subscription-canceled";
import type { TrialEndingProps } from "./trial-ending";
import type { TrialStartedProps } from "./trial-started";
import type { VerifyEmailProps } from "./verify-email";

export type {
  CardExpiringProps,
  OrganizationInvitationProps,
  PaymentDisputedProps,
  PaymentFailedProps,
  PaymentReceiptProps,
  PlanChangedProps,
  ResetPasswordProps,
  SubscriptionCanceledProps,
  TrialEndingProps,
  TrialStartedProps,
  VerifyEmailProps,
};
