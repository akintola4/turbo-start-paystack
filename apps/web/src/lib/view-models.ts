/**
 * Serializable view models. Server loaders in `server/views.ts` build them;
 * page components render them.
 */
import type { PlanState } from "@/lib/plan-state";
import type { SeatUsage } from "@/lib/seats";

export type Role = "owner" | "admin" | "billing" | "member" | "viewer";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "non_renewing"
  | "canceled"
  | "expired"
  | "incomplete";

export type OrgRef = { id: string; name: string; slug: string };
export type OrgListItem = OrgRef & { role: string };

export type UserRef = {
  name: string;
  email: string;
  emailVerified: boolean;
};

export type ShellData = {
  org: OrgRef;
  orgs: OrgListItem[];
  user: UserRef;
  role: string;
  /** Hrefs. `billing` is null when the role can't view billing. */
  nav: {
    overview: string;
    members: string;
    billing: string | null;
    settings: string;
  };
  plan: PlanState;
};

export type SubscriptionSummary = {
  planKey: string;
  planPriceId: string;
  planName: string;
  status: SubscriptionStatus;
  /** Formatted, e.g. "₦30,000.00". */
  priceLabel: string;
  amountSubunit: number;
  currency: string;
  interval: "monthly" | "annually";
  /** ISO strings. */
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  card: { brand: string | null; last4: string; exp: string | null } | null;
  /** A downgrade waiting for the period end; its price is the next charge. */
  scheduled: { planName: string; interval: string; priceLabel: string } | null;
};

export type InvoiceRow = {
  id: string;
  /** ISO. The paid date; for unpaid rows, the period start. */
  date: string;
  /** "Pro plan renewal", "Upgrade to Pro plan". */
  description: string;
  /** "INV-2026-000123", null until paid. */
  number: string | null;
  /** "12 Nov – 12 Dec 2026", when the row covers a period. */
  period: string | null;
  amountLabel: string;
  amountSubunit: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "void";
  href: string;
  pdfHref: string;
};

/** A trial's refunded card check: kept apart from invoices. */
export type CardCheckRow = {
  id: string;
  /** ISO. */
  date: string;
  refundedAt: string | null;
  amountLabel: string;
  href: string;
};

/**
 * The address Paystack bills the organization at. Before its first checkout
 * (`locked: false`) this is the one that checkout would pick: the billing
 * email, the viewer's own, or the viewer's tagged with the organization.
 */
export type PaystackEmailData = {
  email: string;
  locked: boolean;
  source: "billing_email" | "personal" | "tagged" | null;
};

export type BillingDetailsData = {
  legalName: string | null;
  address: string | null;
  taxId: string | null;
  email: string | null;
  /** What invoices use when a field is blank. */
  fallback: { name: string; email: string | null };
  paystackEmail: PaystackEmailData | null;
};

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** ISO. */
  joinedAt: string;
  isMe: boolean;
  /** The viewer may change this member's role. */
  canUpdate: boolean;
  /** The viewer may remove this member. */
  canRemove: boolean;
};

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  /** ISO. */
  expiresAt: string;
};

export type DashboardData = {
  org: OrgRef;
  user: UserRef;
  role: string;
  entitlement: { planName: string; active: boolean; reason: string };
  /** Amounts and dates: only for roles that can view billing. */
  subscription: SubscriptionSummary | null;
  /** Plan name and status word, for every role. */
  plan: PlanState;
  currency: string;
  members: { total: number; limit: number; recent: MemberRow[] };
  seats: SeatUsage;
  pendingInvitations: number;
  /** Roles the viewer may invite with (same rule as the members page). */
  inviteRoles: Role[];
  recentInvoices: InvoiceRow[];
  can: { viewBilling: boolean; manageBilling: boolean; invite: boolean };
  hrefs: { members: string; billing: string | null };
};

export type MembersData = {
  org: OrgRef;
  members: MemberRow[];
  invitations: InvitationRow[];
  /** Roles the viewer may assign when changing a member's role. */
  assignableRoles: Role[];
  /** Roles the viewer may invite with. */
  inviteRoles: Role[];
  can: {
    invite: boolean;
    update: boolean;
    remove: boolean;
    manageBilling: boolean;
  };
  limit: SeatUsage & { planName: string };
  /** Where "Add seats" goes; null when the role can't open billing. */
  billingHref: string | null;
};

export type PlanOption = {
  key: string;
  name: string;
  description: string;
  features: string[];
  trialDays: number;
  memberLimit: number;
  rank: number;
  price: {
    id: string;
    label: string;
    amountSubunit: number;
    interval: "monthly" | "annually";
  } | null;
  /** Monthly-equivalent saving label for annual prices, e.g. "Save 17%". */
  saving: string | null;
  isCurrent: boolean;
  /** What pressing the plan's button does, or null when there is no button. */
  action: "checkout" | "change-plan" | null;
  /** From `planChangeKind`, the rule the server applies. */
  change: "upgrade" | "downgrade" | null;
  /** For an upgrade: what `upgradeChargeNow` charges today (0 in a trial
   *  or when nothing is owed). Null for anything else. */
  chargeNow: { subunit: number; label: string } | null;
  /** Same plan, other interval: the copy talks about billing, not plans. */
  intervalOnly: boolean;
};

export type BillingData = {
  org: OrgRef;
  canManage: boolean;
  currency: string;
  interval: "monthly" | "annually";
  /** From the checkout callback: "succeeded" | "created" | other. */
  payment: string | null;
  subscription: SubscriptionSummary | null;
  entitlement: { planName: string; active: boolean; reason: string };
  /** Plan options for each interval, so the picker can switch without a request. */
  plans: { monthly: PlanOption[]; annually: PlanOption[] };
  invoices: InvoiceRow[];
  invoicePage: {
    page: number;
    pageCount: number;
    total: number;
    /** 1-based positions of the first and last row shown. */
    from: number;
    to: number;
    prevHref: string | null;
    nextHref: string | null;
  };
  cardChecks: CardCheckRow[];
  billingDetails: BillingDetailsData;
  seats: { used: number; limit: number };
  publicKey?: string;
  /** Show the "Simulate billing" dev panel: development, local Paystack
   *  mock and a role that can manage billing. Never true in production. */
  devTools: boolean;
};

export type OrgPickerData = {
  user: UserRef;
  orgs: (OrgListItem & {
    planName: string;
    status: SubscriptionStatus | null;
    memberCount: number;
    /** Billing details, only when the viewer's role can see billing. */
    billing: {
      priceLabel: string;
      /** ISO: next charge, trial end, access end or grace deadline. */
      date: string | null;
      kind: "charge" | "trial" | "ends" | "grace";
    } | null;
    /** Lower sorts first: past due, then trials ending within 7 days. */
    attention: number;
  })[];
  view: "list" | "grid";
};

export type AcceptInviteData = {
  invitationId: string;
  signedIn: boolean;
  signedInAs: string | null;
  invite: {
    orgName: string;
    role: string;
    inviter: string | null;
    /** The invited address, masked: "t***@kola.test". */
    forEmail: string;
    /** Signed in, but as someone other than the invited address. */
    otherAccount: boolean;
  } | null;
  /** Why the link can't be used, when it can't. */
  unusable: "expired" | "accepted" | "revoked" | "unknown" | null;
  hrefs: { signUp: string; signIn: string };
};

export type BillingDeniedData = {
  orgName: string;
  /** People who can manage billing, oldest member first. */
  managers: { name: string; role: string }[];
  overviewHref: string;
};

export type SessionRow = {
  id: string;
  device: string;
  kind: "desktop" | "phone" | "tablet" | "other";
  /** "This computer", "Local network", an IP, or null. */
  location: string | null;
  /** "5 min ago", worked out on the server so it renders once. */
  lastActive: string;
  /** "Signed in 12 Oct 2026". */
  signedIn: string;
  current: boolean;
};

export type AccountData = {
  user: UserRef & { id: string };
  /** `expiresIn`: "another 52 minutes", worked out on the server. */
  pendingEmail: { email: string; expiresAt: string; expiresIn: string } | null;
  sessions: SessionRow[];
  /** Orgs where this user is the only owner: they block deleting it. */
  soleOwnerOf: (OrgRef & { settingsHref: string })[];
};

export type OrgSettingsData = {
  org: OrgRef;
  role: string;
  can: {
    update: boolean;
    /** Transfer ownership and delete: owners only. */
    own: boolean;
    viewBilling: boolean;
  };
  hrefs: {
    billing: string | null;
    billingDetails: string | null;
    members: string;
  };
  memberCount: number;
  /** Who ownership can go to: everyone else in the org. */
  transferTargets: {
    memberId: string;
    name: string;
    email: string;
    role: string;
  }[];
  /** BILLING_CURRENCY, or the subscription's own once it has one. */
  currency: { code: string; fromSubscription: boolean };
  planName: string;
  /** Set when a paid plan stops the owner deleting the org. */
  deleteBlocked: { message: string; accessEndsAt: string | null } | null;
  /** True for the only owner: they can't leave. */
  soleOwner: boolean;
};
