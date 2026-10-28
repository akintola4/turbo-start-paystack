/**
 * Serializable view models. Server loaders in `server/views.ts` build them;
 * page components render them.
 */
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
  nav: { overview: string; members: string; billing: string | null };
  plan: { name: string; status: SubscriptionStatus | null };
};

export type SubscriptionSummary = {
  planKey: string;
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
  scheduled: { planName: string; interval: string } | null;
};

export type InvoiceRow = {
  id: string;
  /** ISO. */
  date: string;
  description: string;
  amountLabel: string;
  amountSubunit: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "void";
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
  subscription: SubscriptionSummary | null;
  members: { total: number; limit: number; recent: MemberRow[] };
  pendingInvitations: number;
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
  can: { invite: boolean; update: boolean; remove: boolean };
  limit: { used: number; max: number; planName: string };
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
  change: "upgrade" | "downgrade" | "switch" | null;
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
  publicKey?: string;
};

export type OrgPickerData = {
  user: UserRef;
  orgs: (OrgListItem & {
    planName: string;
    status: SubscriptionStatus | null;
    memberCount: number;
  })[];
};

export type AcceptInviteData = {
  invitationId: string;
  signedIn: boolean;
  signedInAs: string | null;
  invite: {
    orgName: string;
    /** Seeds the org monogram so its colour matches the rest of the app. */
    orgSlug: string;
    role: string;
    inviter: string | null;
    email: string;
  } | null;
  hrefs: { signUp: string; signIn: string };
};
