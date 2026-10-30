import { SLUG_MAX } from "@workspace/auth/org-rules";

import { formatDate } from "@/lib/format";

/**
 * Rules for the organization settings page that both the route handlers
 * and the forms use: slugs, and when billing blocks a delete. Pure, so the
 * server and the browser agree and tests need no database.
 */

export {
  NAME_MAX,
  nameProblem,
  SLUG_MAX,
  SLUG_MIN,
  slugProblem,
} from "@workspace/auth/org-rules";

/** Name → address, for a new organization. */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

/**
 * What the address field shows while someone types: lowercase, anything
 * else becomes a hyphen. A trailing hyphen stays, so "kola-" can become
 * "kola-ng"; `slugProblem` catches it if it's still there on save.
 */
export function slugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX);
}

export type SubscriptionForDelete = {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | string | null;
  graceUntil: Date | string | null;
};

export type DeleteBlock = {
  reason: "active" | "past_due";
  /** When access ends: the period end once cancelled, or the grace
   *  deadline while a payment is failing. ISO. */
  accessEndsAt: string | null;
};

const iso = (value: Date | string | null) =>
  value === null ? null : new Date(value).toISOString();

/**
 * A paid plan that is still renewing (or failing to) blocks deleting the
 * organization: cancel first, through Billing. Trials, plans already set
 * to end, and free orgs don't block.
 */
export function deleteBlock(
  sub: SubscriptionForDelete | null
): DeleteBlock | null {
  if (!sub) {
    return null;
  }
  if (sub.status === "past_due") {
    return { reason: "past_due", accessEndsAt: iso(sub.graceUntil) };
  }
  if (sub.status === "active" && !sub.cancelAtPeriodEnd) {
    return { reason: "active", accessEndsAt: iso(sub.currentPeriodEnd) };
  }
  return null;
}

/** The sentence shown, and returned by the server, for a blocked delete. */
export function deleteBlockMessage(block: DeleteBlock) {
  const date = block.accessEndsAt ? formatDate(block.accessEndsAt) : null;
  if (block.reason === "past_due") {
    return `A payment is overdue on this plan. Cancel the plan in Billing first${
      date ? `; access ends on ${date} unless the card is updated` : ""
    }.`;
  }
  return `This organization has a paid plan that renews. Cancel it in Billing first${
    date ? `; you keep access until ${date}` : ""
  }, then come back to delete.`;
}
