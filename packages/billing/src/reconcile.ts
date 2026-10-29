import { schema } from "@workspace/db";
import { and, eq, gt, isNull, lt, lte, notInArray } from "drizzle-orm";

import { getPlanPrice } from "./catalog";
import { PaystackError } from "./errors";
import { applyChargeSuccess } from "./service/charge";
import {
  addDays,
  audit,
  type BillingDeps,
  TERMINAL_STATUSES,
  transactionWithNotifications,
  unseal,
} from "./service/context";
import { emailTokenFor } from "./service/switch-plan";
import { resyncSubscription } from "./service/sync-remote";
import { processPending } from "./webhook/process";

export const ABANDON_AFTER_MS = 60 * 60 * 1000;
/** Trial-ending reminders go out this many days before `trial_ends_at`. */
export const TRIAL_REMINDER_DAYS = 3;

export type ReconcileReport = {
  eventsRetried: number;
  intentsConfirmed: number;
  intentsAbandoned: number;
  subscriptionsResynced: number;
  subscriptionsExpired: number;
  replacedDisabled: number;
  trialRemindersSent: number;
  errors: string[];
};

/**
 * Hourly safety net (`/api/cron/billing-reconcile`). Every step is idempotent
 * and derives state from Paystack, so missed, failed or out-of-order
 * webhooks converge:
 * 1. retry unprocessed webhook events;
 * 2. verify checkouts older than an hour (failed payments send no webhook);
 * 3. resync subscriptions whose period ended without a renewal event,
 *    applying scheduled downgrades and ending non-renewing ones;
 * 4. end past_due subscriptions whose grace period ran out;
 * 5. retry disabling subscriptions we replaced during plan changes;
 * 6. remind billing managers TRIAL_REMINDER_DAYS before a trial ends.
 */
export async function reconcile(deps: BillingDeps): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    eventsRetried: 0,
    intentsConfirmed: 0,
    intentsAbandoned: 0,
    subscriptionsResynced: 0,
    subscriptionsExpired: 0,
    replacedDisabled: 0,
    trialRemindersSent: 0,
    errors: [],
  };
  const now = deps.now();
  const step = async (label: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      report.errors.push(`${label}: ${String(error)}`);
      deps.logger.error(`reconcile ${label} failed`, { error: String(error) });
    }
  };

  report.eventsRetried = (await processPending(deps)).processed;

  const staleIntents = await deps.db
    .select()
    .from(schema.paymentIntent)
    .where(
      and(
        eq(schema.paymentIntent.status, "created"),
        lt(
          schema.paymentIntent.createdAt,
          new Date(now.getTime() - ABANDON_AFTER_MS)
        )
      )
    )
    .limit(100);
  for (const intent of staleIntents) {
    await step(`intent ${intent.id}`, async () => {
      let status: string;
      try {
        const tx = await deps.paystack.verifyTransaction(intent.id);
        status = tx.status;
        if (tx.status === "success") {
          await transactionWithNotifications(deps, (t, scoped) =>
            applyChargeSuccess(scoped, t, tx)
          );
          report.intentsConfirmed += 1;
          return;
        }
      } catch (error) {
        if (!(error instanceof PaystackError && error.httpStatus < 500)) {
          throw error;
        }
        status = "not_found";
      }
      if (["abandoned", "failed", "reversed", "not_found"].includes(status)) {
        await deps.db
          .update(schema.paymentIntent)
          .set({ status: status === "failed" ? "failed" : "abandoned" })
          .where(eq(schema.paymentIntent.id, intent.id));
        report.intentsAbandoned += 1;
      }
    });
  }

  const ended = await deps.db
    .select({ id: schema.subscription.id })
    .from(schema.subscription)
    .where(
      and(
        notInArray(schema.subscription.status, [
          ...TERMINAL_STATUSES,
          "past_due",
        ]),
        lt(schema.subscription.currentPeriodEnd, now)
      )
    )
    .limit(200);
  for (const { id } of ended) {
    await step(`subscription ${id}`, async () => {
      await deps.db.transaction(async (tx) => {
        const [sub] = await tx
          .select()
          .from(schema.subscription)
          .where(eq(schema.subscription.id, id))
          .for("update");
        if (!sub) {
          return;
        }
        if (sub.status === "non_renewing" && !sub.scheduledSubscriptionCode) {
          await tx
            .update(schema.subscription)
            .set({ status: "canceled", endedAt: now })
            .where(eq(schema.subscription.id, id));
        } else {
          await resyncSubscription(deps, tx, sub);
        }
        report.subscriptionsResynced += 1;
      });
    });
  }

  const overdue = await deps.db
    .select()
    .from(schema.subscription)
    .where(
      and(
        eq(schema.subscription.status, "past_due"),
        lt(schema.subscription.graceUntil, now)
      )
    )
    .limit(200);
  for (const sub of overdue) {
    await step(`past_due ${sub.id}`, async () => {
      if (sub.paystackSubscriptionCode) {
        const token = await emailTokenFor(
          deps,
          sub.paystackSubscriptionCode,
          sub.paystackEmailToken
        ).catch(() => null);
        if (token) {
          await deps.paystack
            .disableSubscription({ code: sub.paystackSubscriptionCode, token })
            .catch((error) =>
              deps.logger.warn("disable after grace failed", {
                error: String(error),
              })
            );
        }
      }
      await deps.db
        .update(schema.subscription)
        .set({
          status: "canceled",
          endedAt: now,
          canceledAt: sub.canceledAt ?? now,
        })
        .where(eq(schema.subscription.id, sub.id));
      await audit(deps.db, {
        organizationId: sub.organizationId,
        action: "billing.grace_expired",
        target: sub.paystackSubscriptionCode,
      });
      report.subscriptionsExpired += 1;
    });
  }

  const retired = await deps.db
    .select()
    .from(schema.replacedSubscription)
    .where(isNull(schema.replacedSubscription.disabledAt))
    .limit(100);
  for (const row of retired) {
    await step(`replaced ${row.paystackSubscriptionCode}`, async () => {
      const token =
        unseal(deps, row.emailToken) ??
        (await emailTokenFor(deps, row.paystackSubscriptionCode, null));
      if (!token) {
        return;
      }
      await deps.paystack.disableSubscription({
        code: row.paystackSubscriptionCode,
        token,
      });
      await deps.db
        .update(schema.replacedSubscription)
        .set({ disabledAt: now })
        .where(
          eq(
            schema.replacedSubscription.paystackSubscriptionCode,
            row.paystackSubscriptionCode
          )
        );
      report.replacedDisabled += 1;
    });
  }

  report.trialRemindersSent = await sendTrialReminders(deps, now, step);

  return report;
}

/**
 * Claims each reminder with a conditional update (`trial_reminder_sent_at`
 * is null) and emails after the commit, so overlapping cron runs can't both
 * send it. At most once: if the email fails after the claim it is not
 * retried, which is the better failure for a reminder.
 *
 * Reconcile runs it for every organization at the real time. The dev
 * "Simulate billing" panel runs it for one organization as of a date near
 * the trial's end, to play the reminder without waiting 11 days.
 */
export async function sendTrialReminders(
  deps: BillingDeps,
  now: Date,
  step: (label: string, run: () => Promise<void>) => Promise<void> = (
    _label,
    run
  ) => run(),
  organizationId?: string
): Promise<number> {
  const s = schema.subscription;
  const due = await deps.db
    .select({ id: s.id })
    .from(s)
    .where(
      and(
        eq(s.status, "trialing"),
        isNull(s.trialReminderSentAt),
        gt(s.trialEndsAt, now),
        lte(s.trialEndsAt, addDays(now, TRIAL_REMINDER_DAYS)),
        organizationId ? eq(s.organizationId, organizationId) : undefined
      )
    )
    .limit(200);
  let sent = 0;
  for (const { id } of due) {
    await step(`trial reminder ${id}`, async () => {
      await transactionWithNotifications(deps, async (tx, scoped) => {
        const [claimed] = await tx
          .update(s)
          .set({ trialReminderSentAt: now })
          .where(
            and(
              eq(s.id, id),
              eq(s.status, "trialing"),
              isNull(s.trialReminderSentAt)
            )
          )
          .returning();
        // A downgrade scheduled during the trial is what gets charged.
        const planPriceId =
          claimed?.scheduledPlanPriceId ?? claimed?.planPriceId;
        const price = planPriceId ? getPlanPrice(planPriceId) : undefined;
        if (!(claimed?.trialEndsAt && price && planPriceId)) {
          return;
        }
        await scoped.notify?.({
          type: "trial_ending",
          organizationId: claimed.organizationId,
          key: `trial_ending:${claimed.id}`,
          planPriceId,
          trialEndsAt: claimed.trialEndsAt,
          amountSubunit: price.amountSubunit,
          currency: price.currency,
        });
        sent += 1;
      });
    });
  }
  return sent;
}
