import "server-only";

import { ROLE_RANK, type Role, rankOf } from "@workspace/auth/permissions";
import {
  type Currency,
  catalog,
  getPlan,
  getPlanPrice,
  planPriceId,
} from "@workspace/billing";
import { schema } from "@workspace/db";
import { env as clientEnv } from "@workspace/env/client";
import { env } from "@workspace/env/server";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import type {
  AcceptInviteData,
  BillingData,
  DashboardData,
  InvoiceRow,
  MemberRow,
  MembersData,
  OrgPickerData,
  PlanOption,
  ShellData,
  SubscriptionStatus,
  SubscriptionSummary,
} from "@/lib/view-models";
import { formatMoney } from "@/lib/money";
import { getServerContext } from "./context";
import {
  listMyOrganizations,
  requireOrgBySlug,
  requireSession,
} from "./session";

type Membership = Awaited<ReturnType<typeof requireOrgBySlug>>;
type Subscription = NonNullable<
  Awaited<
    ReturnType<
      ReturnType<typeof getServerContext>["billing"]["getSubscription"]
    >
  >
>;
type Invoice = Awaited<
  ReturnType<ReturnType<typeof getServerContext>["billing"]["listInvoices"]>
>[number];

const iso = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

function userRef(membershipOrSession: {
  user: { name: string; email: string; emailVerified: boolean };
}) {
  const { name, email, emailVerified } = membershipOrSession.user;
  return { name, email, emailVerified };
}

function summarize(
  sub: Subscription | null | undefined
): SubscriptionSummary | null {
  if (!sub) {
    return null;
  }
  const price = getPlanPrice(sub.planPriceId);
  const plan = price ? getPlan(price.planKey) : undefined;
  const scheduled = sub.scheduledPlanPriceId
    ? getPlanPrice(sub.scheduledPlanPriceId)
    : undefined;
  return {
    planKey: price?.planKey ?? "free",
    planName: plan?.name ?? "Free",
    status: sub.status as SubscriptionStatus,
    priceLabel: price ? formatMoney(price.amountSubunit, price.currency) : "",
    amountSubunit: price?.amountSubunit ?? 0,
    currency: sub.currency,
    interval: price?.interval ?? "monthly",
    currentPeriodEnd: iso(sub.currentPeriodEnd),
    trialEndsAt: iso(sub.trialEndsAt),
    graceUntil: iso(sub.graceUntil),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    card: sub.cardLast4
      ? { brand: sub.cardBrand, last4: sub.cardLast4, exp: sub.cardExp }
      : null,
    scheduled: scheduled
      ? {
          planName: getPlan(scheduled.planKey)?.name ?? scheduled.planKey,
          interval: scheduled.interval,
        }
      : null,
  };
}

function invoiceRow(invoice: Invoice): InvoiceRow {
  return {
    id: invoice.id,
    date: (invoice.paidAt ?? invoice.createdAt).toISOString(),
    // The status badge already says "Refunded".
    description: (invoice.description ?? "Subscription").replace(
      /\s*\(refunded\)$/i,
      ""
    ),
    amountLabel: formatMoney(
      Number(invoice.amountSubunit),
      invoice.currency as Currency
    ),
    amountSubunit: Number(invoice.amountSubunit),
    currency: invoice.currency,
    status: invoice.status,
  };
}

async function listMembers(membership: Membership): Promise<MemberRow[]> {
  const { db } = getServerContext();
  const { organization, member: me, can } = membership;
  const myRank = rankOf(me.role);
  const rows = await db
    .select({
      id: schema.member.id,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
      email: schema.user.email,
      name: schema.user.name,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, organization.id))
    .orderBy(schema.member.createdAt);
  return rows.map((m) => {
    const manageable = m.id !== me.id && rankOf(m.role) <= myRank;
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role as Role,
      joinedAt: m.createdAt.toISOString(),
      isMe: m.id === me.id,
      canUpdate: can("member:update") && manageable,
      canRemove: can("member:delete") && manageable,
    };
  });
}

export async function loadShell(orgSlug: string): Promise<ShellData> {
  const membership = await requireOrgBySlug(orgSlug);
  const { organization, session, member, can } = membership;
  const [orgs, sub] = await Promise.all([
    listMyOrganizations(session.user.id),
    getServerContext().billing.getSubscription(organization.id),
  ]);
  const base = `/app/${orgSlug}`;
  const summary = summarize(sub);
  return {
    org: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    orgs,
    user: userRef(session),
    role: member.role,
    nav: {
      overview: base,
      members: `${base}/members`,
      billing: can("billing:view") ? `${base}/settings/billing` : null,
    },
    plan: {
      name: summary?.planName ?? "Free",
      status: summary?.status ?? null,
    },
  };
}

export async function loadDashboard(orgSlug: string): Promise<DashboardData> {
  const membership = await requireOrgBySlug(orgSlug);
  const { organization, session, member, can } = membership;
  const { billing, db } = getServerContext();
  const [sub, entitlement, invoices, members, [pending]] = await Promise.all([
    billing.getSubscription(organization.id),
    billing.getEntitlement(organization.id),
    can("billing:view")
      ? billing.listInvoices(organization.id)
      : Promise.resolve([]),
    listMembers(membership),
    db
      .select({ n: count() })
      .from(schema.invitation)
      .where(
        and(
          eq(schema.invitation.organizationId, organization.id),
          eq(schema.invitation.status, "pending"),
          gt(schema.invitation.expiresAt, new Date())
        )
      ),
  ]);
  const base = `/app/${orgSlug}`;
  return {
    org: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    user: userRef(session),
    role: member.role,
    entitlement: {
      planName: entitlement.plan.name,
      active: entitlement.active,
      reason: entitlement.reason,
    },
    subscription: can("billing:view") ? summarize(sub) : null,
    members: {
      total: members.length,
      limit: entitlement.plan.limits.members,
      recent: [...members].reverse().slice(0, 5),
    },
    pendingInvitations: can("invitation:create") ? (pending?.n ?? 0) : 0,
    recentInvoices: invoices.slice(0, 4).map(invoiceRow),
    can: {
      viewBilling: can("billing:view"),
      manageBilling: can("billing:manage"),
      invite: can("invitation:create"),
    },
    hrefs: {
      members: `${base}/members`,
      billing: can("billing:view") ? `${base}/settings/billing` : null,
    },
  };
}

export async function loadMembers(orgSlug: string): Promise<MembersData> {
  const membership = await requireOrgBySlug(orgSlug);
  const { organization, member: me, can } = membership;
  const { db, billing } = getServerContext();
  const canInvite = can("invitation:create");
  const [members, invitations, entitlement] = await Promise.all([
    listMembers(membership),
    canInvite
      ? db
          .select({
            id: schema.invitation.id,
            email: schema.invitation.email,
            role: schema.invitation.role,
            expiresAt: schema.invitation.expiresAt,
          })
          .from(schema.invitation)
          .where(
            and(
              eq(schema.invitation.organizationId, organization.id),
              eq(schema.invitation.status, "pending"),
              gt(schema.invitation.expiresAt, new Date())
            )
          )
      : Promise.resolve([]),
    billing.getEntitlement(organization.id),
  ]);
  const myRank = rankOf(me.role);
  const assignableRoles = (Object.keys(ROLE_RANK) as Role[]).filter(
    (role) => ROLE_RANK[role] <= myRank
  );
  return {
    org: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    members,
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role ?? "member",
      expiresAt: inv.expiresAt.toISOString(),
    })),
    assignableRoles,
    inviteRoles: assignableRoles.filter(
      (r) => r !== "owner" || myRank >= ROLE_RANK.owner
    ),
    can: {
      invite: canInvite,
      update: can("member:update"),
      remove: can("member:delete"),
    },
    limit: {
      used: members.length + invitations.length,
      max: entitlement.plan.limits.members,
      planName: entitlement.plan.name,
    },
  };
}

type CatalogPlan = (typeof catalog)[number];

function annualSaving(plan: CatalogPlan, currency: Currency) {
  if (!plan.prices.length) {
    return null;
  }
  const annual = getPlanPrice(planPriceId(plan.key, "annually", currency));
  const monthly = getPlanPrice(planPriceId(plan.key, "monthly", currency));
  if (!(annual && monthly)) {
    return null;
  }
  const pct = Math.round(
    (1 - annual.amountSubunit / (monthly.amountSubunit * 12)) * 100
  );
  return `Save ${pct}%`;
}

function changeKind(
  action: PlanOption["action"],
  rank: number,
  currentRank: number
): PlanOption["change"] {
  if (action !== "change-plan") {
    return null;
  }
  if (rank === currentRank) {
    return "switch";
  }
  return rank > currentRank ? "upgrade" : "downgrade";
}

/** One plan tile's data for an interval; `currentPriceId` is null when on Free. */
function planOption(
  plan: CatalogPlan,
  interval: "monthly" | "annually",
  currency: Currency,
  currentPriceId: string | null,
  currentRank: number
): PlanOption {
  const id = plan.prices.length
    ? planPriceId(plan.key, interval, currency)
    : null;
  const price = id ? getPlanPrice(id) : undefined;
  const isCurrent = currentPriceId
    ? currentPriceId === id
    : plan.key === "free";
  let action: PlanOption["action"] = null;
  if (price && id && !isCurrent) {
    action = currentPriceId ? "change-plan" : "checkout";
  }
  return {
    key: plan.key,
    name: plan.name,
    description: plan.description,
    features: [...plan.features],
    trialDays: plan.trialDays,
    memberLimit: plan.limits.members,
    rank: plan.rank,
    price:
      price && id
        ? {
            id,
            label: formatMoney(price.amountSubunit, price.currency),
            amountSubunit: price.amountSubunit,
            interval: price.interval,
          }
        : null,
    saving: interval === "annually" ? annualSaving(plan, currency) : null,
    isCurrent,
    action,
    change: changeKind(action, plan.rank, currentRank),
  };
}

export async function loadBilling(
  orgSlug: string,
  search: { payment?: string; interval?: string }
): Promise<BillingData> {
  const { organization, can } = await requireOrgBySlug(orgSlug);
  if (!can("billing:view")) {
    notFound();
  }
  const { billing } = getServerContext();
  const [sub, entitlement, invoices, [seatRow]] = await Promise.all([
    billing.getSubscription(organization.id),
    billing.getEntitlement(organization.id),
    billing.listInvoices(organization.id),
    getServerContext()
      .db.select({ n: count() })
      .from(schema.member)
      .where(eq(schema.member.organizationId, organization.id)),
  ]);
  const currency = (sub?.currency ?? env.BILLING_CURRENCY) as Currency;
  const currentPrice = sub ? getPlanPrice(sub.planPriceId) : undefined;
  const interval =
    search.interval === "annually" || search.interval === "monthly"
      ? search.interval
      : (currentPrice?.interval ?? "monthly");
  const currentPlan = currentPrice ? getPlan(currentPrice.planKey) : undefined;
  const currentRank = currentPlan?.rank ?? 0;

  const plansFor = (interval: "monthly" | "annually") =>
    catalog.map((plan) =>
      planOption(
        plan,
        interval,
        currency,
        sub?.planPriceId ?? null,
        currentRank
      )
    );
  return {
    org: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    canManage: can("billing:manage"),
    currency,
    interval,
    payment: search.payment ?? null,
    subscription: summarize(sub),
    entitlement: {
      planName: entitlement.plan.name,
      active: entitlement.active,
      reason: entitlement.reason,
    },
    plans: { monthly: plansFor("monthly"), annually: plansFor("annually") },
    invoices: invoices.map(invoiceRow),
    seats: { used: seatRow?.n ?? 1, limit: entitlement.plan.limits.members },
    publicKey: clientEnv.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  };
}

export async function loadOrgPicker(): Promise<OrgPickerData> {
  const session = await requireSession();
  const orgs = await listMyOrganizations(session.user.id);
  const { db, billing } = getServerContext();
  const ids = orgs.map((o) => o.id);
  const counts = ids.length
    ? await db
        .select({ org: schema.member.organizationId, n: count() })
        .from(schema.member)
        .where(inArray(schema.member.organizationId, ids))
        .groupBy(schema.member.organizationId)
    : [];
  const subs = await Promise.all(ids.map((id) => billing.getSubscription(id)));
  return {
    user: userRef(session),
    orgs: orgs.map((org, i) => {
      const summary = summarize(subs[i]);
      return {
        ...org,
        planName: summary?.planName ?? "Free",
        status: summary?.status ?? null,
        memberCount: counts.find((c) => c.org === org.id)?.n ?? 1,
      };
    }),
  };
}

export async function loadAcceptInvite(id: string): Promise<AcceptInviteData> {
  const requestHeaders = await headers();
  const { authService, db } = getServerContext();
  const session = await authService.auth.api.getSession({
    headers: requestHeaders,
  });
  const callback = `/accept-invite/${id}`;
  // The id is the bearer token for this link, so showing which organization
  // it is for adds nothing an attacker without the link could learn.
  const [row] = await db
    .select({
      orgName: schema.organization.name,
      orgSlug: schema.organization.slug,
      role: schema.invitation.role,
      email: schema.invitation.email,
      inviter: schema.user.name,
    })
    .from(schema.invitation)
    .innerJoin(
      schema.organization,
      eq(schema.invitation.organizationId, schema.organization.id)
    )
    .leftJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
    .where(
      and(
        eq(schema.invitation.id, id),
        eq(schema.invitation.status, "pending"),
        gt(schema.invitation.expiresAt, new Date())
      )
    )
    .limit(1);
  return {
    invitationId: id,
    signedIn: Boolean(session),
    signedInAs: session?.user.email ?? null,
    invite: row
      ? {
          orgName: row.orgName,
          orgSlug: row.orgSlug,
          role: row.role ?? "member",
          inviter: row.inviter,
          email: session ? row.email : "",
        }
      : null,
    hrefs: {
      signUp: `/sign-up?callbackURL=${encodeURIComponent(callback)}`,
      signIn: `/sign-in?callbackURL=${encodeURIComponent(callback)}`,
    },
  };
}
