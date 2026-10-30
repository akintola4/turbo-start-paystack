import type { ComponentType } from "react";

import type { EmailContent } from "../content";
import type { EmailTheme } from "../theme";
import {
  CardExpiring,
  cardExpiringContent,
  cardExpiringSubject,
} from "./card-expiring";
import {
  ChangeEmailApproval,
  changeEmailApprovalContent,
  changeEmailApprovalSubject,
} from "./change-email-approval";
import {
  OrganizationInvitation,
  organizationInvitationContent,
  organizationInvitationSubject,
} from "./organization-invitation";
import {
  PaymentDisputed,
  paymentDisputedContent,
  paymentDisputedSubject,
} from "./payment-disputed";
import {
  PaymentFailed,
  paymentFailedContent,
  paymentFailedSubject,
} from "./payment-failed";
import {
  PaymentReceipt,
  paymentReceiptContent,
  paymentReceiptSubject,
} from "./payment-receipt";
import {
  PlanChanged,
  planChangedContent,
  planChangedSubject,
} from "./plan-changed";
import {
  ResetPassword,
  resetPasswordContent,
  resetPasswordSubject,
} from "./reset-password";
import {
  SubscriptionCanceled,
  subscriptionCanceledContent,
  subscriptionCanceledSubject,
} from "./subscription-canceled";
import {
  TrialEnding,
  trialEndingContent,
  trialEndingSubject,
} from "./trial-ending";
import {
  TrialStarted,
  trialStartedContent,
  trialStartedSubject,
} from "./trial-started";
import {
  VerifyEmail,
  verifyEmailContent,
  verifyEmailSubject,
} from "./verify-email";

type Template<P> = {
  Component: ComponentType<P & { theme?: EmailTheme }> & { PreviewProps: P };
  subject: (props: P) => string;
  /** What the email says; the HTML and the plain text both render it. */
  content: (props: P, theme: EmailTheme) => EmailContent;
};

const define = <P>(
  Component: Template<P>["Component"],
  subject: Template<P>["subject"],
  content: Template<P>["content"]
): Template<P> => ({ Component, subject, content });

/** Every email, by name. Previews, tests and the screenshot export iterate
 *  over this, so a new template only needs adding here. */
export const templates = {
  "verify-email": define<VerifyEmailProps>(
    VerifyEmail,
    verifyEmailSubject,
    verifyEmailContent
  ),
  "change-email-approval": define<ChangeEmailApprovalProps>(
    ChangeEmailApproval,
    changeEmailApprovalSubject,
    changeEmailApprovalContent
  ),
  "reset-password": define<ResetPasswordProps>(
    ResetPassword,
    resetPasswordSubject,
    resetPasswordContent
  ),
  "organization-invitation": define<OrganizationInvitationProps>(
    OrganizationInvitation,
    organizationInvitationSubject,
    organizationInvitationContent
  ),
  "payment-receipt": define<PaymentReceiptProps>(
    PaymentReceipt,
    paymentReceiptSubject,
    paymentReceiptContent
  ),
  "payment-failed": define<PaymentFailedProps>(
    PaymentFailed,
    paymentFailedSubject,
    paymentFailedContent
  ),
  "trial-ending": define<TrialEndingProps>(
    TrialEnding,
    trialEndingSubject,
    trialEndingContent
  ),
  "subscription-canceled": define<SubscriptionCanceledProps>(
    SubscriptionCanceled,
    subscriptionCanceledSubject,
    subscriptionCanceledContent
  ),
  "plan-changed": define<PlanChangedProps>(
    PlanChanged,
    planChangedSubject,
    planChangedContent
  ),
  "trial-started": define<TrialStartedProps>(
    TrialStarted,
    trialStartedSubject,
    trialStartedContent
  ),
  "card-expiring": define<CardExpiringProps>(
    CardExpiring,
    cardExpiringSubject,
    cardExpiringContent
  ),
  "payment-disputed": define<PaymentDisputedProps>(
    PaymentDisputed,
    paymentDisputedSubject,
    paymentDisputedContent
  ),
};

export type TemplateName = keyof typeof templates;
export type TemplateProps<N extends TemplateName> = Parameters<
  (typeof templates)[N]["subject"]
>[0];

import type { CardExpiringProps } from "./card-expiring";
import type { ChangeEmailApprovalProps } from "./change-email-approval";
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
  ChangeEmailApprovalProps,
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
