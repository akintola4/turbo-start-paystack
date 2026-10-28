export type BillingErrorCode =
  | "plan_not_found"
  | "plan_not_synced"
  | "already_subscribed"
  | "no_subscription"
  | "currency_locked"
  | "same_plan"
  | "over_member_limit"
  | "no_card"
  | "invalid_state"
  | "upgrade_failed"
  | "downgrade_failed"
  | "paystack_error";

/** Expected, user-facing billing failures. Route handlers map these to 4xx. */
export class BillingError extends Error {
  readonly code: BillingErrorCode;

  constructor(code: BillingErrorCode, message: string) {
    super(message);
    this.name = "BillingError";
    this.code = code;
  }
}

/** Paystack answered with `status: false` or a non-2xx after retries. */
export class PaystackError extends Error {
  readonly httpStatus: number;

  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = "PaystackError";
    this.httpStatus = httpStatus;
  }
}
