import { roleHasPermission } from "@workspace/auth/roles";
import type { BillingNotification } from "@workspace/billing";
import { getPlan, getPlanPrice } from "@workspace/billing/catalog";
import { type Database, schema } from "@workspace/db";
import type { Mailer } from "@workspace/email";
import { Logger } from "@workspace/logger";
import { eq } from "drizzle-orm";

const logger = new Logger("billing-emails");

type Plan = { name: string; interval: string; label: string };

function planOf(planPriceId: string): Plan {
  const price = getPlanPrice(planPriceId);
  const name = (price && getPlan(price.planKey)?.name) ?? planPriceId;
  const interval = price?.interval ?? "monthly";
  const shown = interval === "annually" ? "yearly" : interval;
  return { name, interval, label: `${name} (${shown})` };
}

type Org = { organizationName: string; organizationSlug: string };
type Recipient = { to: string; key: string } & Org;

/** One email per notification type. Org names come from our database and
 *  are rendered as escaped text; links are built by the mailer. */
function sendOne(mailer: Mailer, n: BillingNotification, r: Recipient) {
  switch (n.type) {
    case "payment_succeeded": {
      const plan = planOf(n.planPriceId);
      return mailer.paymentReceipt({
        ...r,
        planName: plan.name,
        interval: plan.interval,
        amountSubunit: n.amountSubunit,
        currency: n.currency,
        reference: n.reference,
        paidAt: n.paidAt,
        periodStart: n.periodStart,
        periodEnd: n.periodEnd,
      });
    }
    case "past_due":
      return mailer.paymentFailed({
        ...r,
        planName: planOf(n.planPriceId).name,
        graceUntil: n.graceUntil,
        manageLink: n.manageLink,
      });
    case "trial_started":
      return mailer.trialStarted({
        ...r,
        planName: planOf(n.planPriceId).name,
        trialEndsAt: n.trialEndsAt,
      });
    case "trial_ending": {
      const plan = planOf(n.planPriceId);
      return mailer.trialEnding({
        ...r,
        planName: plan.name,
        interval: plan.interval,
        trialEndsAt: n.trialEndsAt,
        amountSubunit: n.amountSubunit,
        currency: n.currency,
      });
    }
    case "subscription_canceled":
      return mailer.subscriptionCanceled({
        ...r,
        planName: planOf(n.planPriceId).name,
        accessUntil: n.accessUntil,
      });
    case "plan_changed":
      return mailer.planChanged({
        ...r,
        change: n.change,
        fromPlan: planOf(n.fromPlanPriceId).label,
        toPlan: planOf(n.toPlanPriceId).label,
        chargedSubunit: n.chargedSubunit,
        currency: n.currency,
        effectiveAt: n.effectiveAt,
      });
    case "expiring_card":
      return mailer.cardExpiring({ ...r, manageLink: n.manageLink });
    case "dispute":
      return mailer.paymentDisputed({ ...r, reference: n.reference });
    default: {
      const unhandled: never = n;
      throw new Error(`Unknown notification ${String(unhandled)}`);
    }
  }
}

/**
 * Emails everyone who can manage billing in the organization. Called after
 * the billing transaction commits. Failures are logged per recipient so one
 * bad address doesn't stop the rest.
 */
export async function notifyBillingAdmins(
  deps: { db: Database; mailer: Mailer },
  notification: BillingNotification
) {
  const [org] = await deps.db
    .select({ name: schema.organization.name, slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, notification.organizationId));
  if (!org) {
    return;
  }
  const members = await deps.db
    .select({ email: schema.user.email, role: schema.member.role })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, notification.organizationId));
  const recipients = members.filter((m) =>
    roleHasPermission(m.role, "billing:manage")
  );
  for (const recipient of recipients) {
    try {
      await sendOne(deps.mailer, notification, {
        to: recipient.email,
        key: notification.key,
        organizationName: org.name,
        organizationSlug: org.slug,
      });
    } catch (error) {
      logger.error("billing notification failed", {
        type: notification.type,
        organizationId: notification.organizationId,
        error: String(error),
      });
    }
  }
}
