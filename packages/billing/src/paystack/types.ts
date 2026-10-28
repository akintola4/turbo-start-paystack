import { z } from "zod";

/** Paystack sometimes returns `metadata` as a JSON string. */
export const metadataSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value ?? {};
}, z.looseObject({}));

const planRef = z
  .union([
    z.looseObject({ plan_code: z.string().optional() }),
    z.string(),
    z.null(),
  ])
  .optional();

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

export const customerRefSchema = z.looseObject({
  customer_code: z.string(),
  email: z.string().optional(),
  id: z.union([z.number(), z.string()]).optional(),
});

export const transactionSchema = z.looseObject({
  id: z.union([z.number(), z.string()]).optional(),
  status: z.string(),
  reference: z.string(),
  amount: z.number(),
  currency: z.string(),
  paid_at: z.string().nullish(),
  metadata: metadataSchema.optional(),
  authorization: authorizationSchema.nullish(),
  customer: customerRefSchema.nullish(),
  plan: planRef,
  paused: z.boolean().optional(),
  authorization_url: z.string().nullish(),
});
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
  next_payment_date: z.string().nullish(),
  plan: planRef,
  customer: z.union([customerRefSchema, z.number(), z.string()]).nullish(),
  authorization: z
    .union([authorizationSchema, z.number(), z.string()])
    .nullish(),
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
