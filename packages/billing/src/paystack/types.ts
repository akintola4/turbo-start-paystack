import { z } from "zod";

/*
 * Paystack's payloads are looser than its docs suggest, and the shape of a
 * field changes between events and endpoints. Seen in Paystack's documented
 * samples and in real test-mode traffic:
 * - `plan` is a plan object on renewals, `{}` or `null` on one-off charges,
 *   and a numeric plan id on `POST /subscription` (and `0` on some
 *   transactions);
 * - `customer` and `authorization` are objects in webhooks but numeric ids
 *   in `POST /subscription`'s response, and `authorization` is `{}` on a
 *   transaction that was never paid;
 * - `metadata` is an object, a JSON string, `""` or `0`;
 * - the paid date is `paid_at`, `paidAt`, or both.
 * Fields that only describe are parsed leniently so a new shape cannot fail
 * a whole event. Fields that decide billing state (status, reference,
 * amount, currency, customer code, subscription code) stay strict.
 */

/** Object metadata, from an object or a JSON string; anything else is `{}`. */
export const metadataSchema = z.preprocess((value) => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : {};
}, z.looseObject({}));

/** A plan object, a plan code, a numeric plan id, or nothing. Read it with
 *  `planCodeOf`; an id or `{}` carries no plan code. */
const planRef = z
  .union([
    z.looseObject({ plan_code: z.string().optional() }),
    z.string(),
    z.number(),
    z.null(),
  ])
  .optional()
  .catch(undefined);

/** A date as an ISO string, from an ISO string or a Unix timestamp. */
export const paystackDate = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const date =
      typeof value === "number"
        ? new Date(value < 1e12 ? value * 1000 : value)
        : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  })
  .catch(null);

export const authorizationSchema = z.looseObject({
  authorization_code: z.string(),
  reusable: z.boolean().optional(),
  signature: z.string().nullish(),
  last4: z.string().nullish(),
  exp_month: z.string().nullish(),
  exp_year: z.string().nullish(),
  brand: z.string().nullish(),
  card_type: z.string().nullish(),
  channel: z.string().nullish(),
});

/** An authorization object, or null when there is none to use (`{}` on an
 *  unpaid transaction, a numeric id in `POST /subscription`). */
const authorizationRef = z.preprocess(
  (value) =>
    value &&
    typeof value === "object" &&
    "authorization_code" in value &&
    (value as { authorization_code?: unknown }).authorization_code
      ? value
      : null,
  authorizationSchema.nullable()
);

export const customerRefSchema = z.looseObject({
  customer_code: z.string(),
  email: z.string().nullish(),
  id: z.union([z.number(), z.string()]).optional(),
});

export const transactionSchema = z.preprocess(
  (value) => {
    // `GET /transaction/verify` sends `paidAt` next to (or instead of)
    // `paid_at`. One field from here on.
    if (value && typeof value === "object" && !("paid_at" in value)) {
      return { ...value, paid_at: (value as { paidAt?: unknown }).paidAt };
    }
    return value;
  },
  z.looseObject({
    id: z.union([z.number(), z.string()]).optional(),
    status: z.string(),
    reference: z.string(),
    amount: z.number().int(),
    currency: z.string(),
    paid_at: paystackDate,
    metadata: metadataSchema.optional(),
    authorization: authorizationRef.optional(),
    customer: customerRefSchema.nullish(),
    plan: planRef,
    paused: z.boolean().optional(),
    authorization_url: z.string().nullish(),
  })
);
export type PaystackTransaction = z.infer<typeof transactionSchema>;

export const initializeSchema = z.looseObject({
  authorization_url: z.string(),
  access_code: z.string(),
  reference: z.string(),
});

export const customerSchema = z.looseObject({
  customer_code: z.string(),
  email: z.string(),
  id: z.union([z.number(), z.string()]).optional(),
});

export const subscriptionSchema = z.looseObject({
  subscription_code: z.string(),
  email_token: z.string().nullish(),
  status: z.string().optional(),
  next_payment_date: paystackDate,
  plan: planRef,
  customer: z.union([customerRefSchema, z.number(), z.string()]).nullish(),
  authorization: z
    .union([authorizationSchema, z.number(), z.string()])
    .nullish()
    .catch(null),
});
export type PaystackSubscription = z.infer<typeof subscriptionSchema>;

export const planSchema = z.looseObject({
  plan_code: z.string(),
  name: z.string(),
  amount: z.number(),
  interval: z.string(),
  currency: z.string(),
});
export type PaystackPlan = z.infer<typeof planSchema>;

/** `GET /customer/:code`: only the numeric id, to list its subscriptions. */
export const customerDetailSchema = z.looseObject({
  id: z.union([z.number(), z.string()]),
  customer_code: z.string(),
});

export const manageLinkSchema = z.looseObject({ link: z.string() });

export const refundSchema = z.looseObject({
  status: z.string().optional(),
});

export function planCodeOf(plan: unknown): string | undefined {
  if (typeof plan === "string") {
    return plan || undefined;
  }
  if (plan && typeof plan === "object" && "plan_code" in plan) {
    const code = (plan as { plan_code?: unknown }).plan_code;
    return typeof code === "string" ? code : undefined;
  }
  return;
}
