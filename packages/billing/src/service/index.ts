import { schema } from "@workspace/db";
import { Logger } from "@workspace/logger";
import { desc, eq, sql } from "drizzle-orm";

import { getEntitlement } from "../entitlements";
import { BillingError } from "../errors";
import { reconcile, sendTrialReminders } from "../reconcile";
import { processEvent, processPending } from "../webhook/process";
import { applyChargeSuccess } from "./charge";
import { type Actor, startCheckout } from "./checkout";
import {
  type BillingDeps,
  liveSubscription,
  transactionWithNotifications,
} from "./context";
import {
  cancelSubscription,
  changePlan,
  getManageCardLink,
  resumeSubscription,
} from "./plan-change";

/** The date an invoice is listed under: paid date, else the period it is
 *  for, else when we first heard of it. */
export const invoiceDateSql = sql<Date>`coalesce(${schema.invoice.paidAt}, ${schema.invoice.periodStart}, ${schema.invoice.createdAt})`;

export function invoiceDate(invoice: {
  paidAt: Date | null;
  periodStart: Date | null;
  createdAt: Date;
}): Date {
  return invoice.paidAt ?? invoice.periodStart ?? invoice.createdAt;
}

export type CreateBillingServiceOptions = Omit<BillingDeps, "now" | "logger"> &
  Partial<Pick<BillingDeps, "now" | "logger">>;

export function createBillingService(options: CreateBillingServiceOptions) {
  const deps: BillingDeps = {
    ...options,
    now: options.now ?? (() => new Date()),
    logger: options.logger ?? new Logger("billing"),
  };

  return {
    deps,
    startCheckout: (input: {
      organizationId: string;
      actor: Actor;
      planPriceId: string;
    }) => startCheckout(deps, input),

    /**
     * Server-side confirmation from the checkout callback page. Uses
     * `GET /transaction/verify/:reference`, then the same code path as the
     * `charge.success` webhook. The reference must belong to `organizationId`.
     */
    async confirmByReference(organizationId: string, reference: string) {
      const [intent] = await deps.db
        .select()
        .from(schema.paymentIntent)
        .where(eq(schema.paymentIntent.id, reference));
      if (!intent || intent.organizationId !== organizationId) {
        throw new BillingError("no_subscription", "Unknown payment reference");
      }
      if (intent.status === "created") {
        const tx = await deps.paystack.verifyTransaction(reference);
        if (tx.status === "success") {
          await transactionWithNotifications(deps, (t, scoped) =>
            applyChargeSuccess(scoped, t, tx)
          );
        }
      }
      const [after] = await deps.db
        .select({ status: schema.paymentIntent.status })
        .from(schema.paymentIntent)
        .where(eq(schema.paymentIntent.id, reference));
      return {
        paymentStatus: after?.status ?? intent.status,
        subscription: await liveSubscription(deps.db, organizationId),
      };
    },

    processEvent: (eventId: string) => processEvent(deps, eventId),
    processPending: (limit?: number) => processPending(deps, limit),

    getSubscription: (organizationId: string) =>
      liveSubscription(deps.db, organizationId),

    async getEntitlement(organizationId: string) {
      return getEntitlement(
        await liveSubscription(deps.db, organizationId),
        deps.now()
      );
    },

    listInvoices: (organizationId: string) =>
      deps.db
        .select()
        .from(schema.invoice)
        .where(eq(schema.invoice.organizationId, organizationId))
        // Newest first by the date the row shows (see `invoiceDate`), not
        // by insert time: a failed attempt inserts its row long before the
        // payment that settles it.
        .orderBy(desc(invoiceDateSql), desc(schema.invoice.id))
        .limit(50),

    changePlan: (input: {
      organizationId: string;
      actor: Actor;
      planPriceId: string;
      memberCount: number;
    }) => changePlan(deps, input),

    cancel: (input: { organizationId: string; actor: Actor }) =>
      cancelSubscription(deps, input),

    resume: (input: { organizationId: string; actor: Actor }) =>
      resumeSubscription(deps, input),

    getManageCardLink: (organizationId: string) =>
      getManageCardLink(deps, organizationId),

    reconcile: () => reconcile(deps),
    /** The reconcile trial-reminder step for one organization, as of `asOf`
     *  (development: the "Simulate billing" panel). */
    sendTrialReminders: (input: { organizationId: string; asOf: Date }) =>
      sendTrialReminders(deps, input.asOf, undefined, input.organizationId),
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
